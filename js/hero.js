'use strict';
// v1.0.138: the hero for the angled camera (2.5D, step 2 piece 1). A standing figure seen from the camera's angle,
// facing one of 8 directions, with legs that walk, a body that breathes and arms that reach for the hands and weapons
// (render.js heroHands, the same poses as the top-down hero). Dark, worn colours; 25% bigger than the old figure.
// Gameplay never changes: the hit circle stays G.p.r. The Top-down camera keeps the old hero (render.js drawPlayer).
//
// Everything is placed by projecting the hero's own floor frame (lx along the facing, ly to the main-hand side, h up)
// onto the screen (heroProj), so one painter covers every direction. The body (legs, torso, head) is painted once per
// look, direction and walk frame into a sprite (sprites.js sprite); arms, hands and weapons are drawn live on top,
// the far side behind the body and the near side in front of it.
const HERO_K=1.1,HERO_FR=8; // hands, reach and weapons against the old figure (the body is about 57 tall, 25% more presence than the old 30-wide disc); walk frames per stride
const HERO_HAND_H=22,HERO_SH_H=38; // hand and shoulder height
// Class looks with nothing special worn. w: half the shoulders' width, d: half the body's depth.
const HERO_LOOK={
  warden:{skin:'#a8805e',hair:'#24180f',beard:1,torso:'#4a3626',chest:'#5c4632',trim:'#7a6a58',legs:'#3a2c20',boots:'#1e150d',sleeve:'#4e3a28',w:12.5,d:7,waist:9,pads:'#5a5650',head:'bare'},
  arcanist:{skin:'#c2a284',hair:'#18121c',torso:'#33243e',chest:'#3e2c4c',trim:'#8a6a30',legs:'#251c2e',boots:'#16121a',sleeve:'#33243e',w:9.5,d:5.5,waist:7,robe:1,head:'cowl',hood:'#2a1e34'},
  ranger:{skin:'#b08862',hair:'#352616',torso:'#384024',chest:'#46502c',trim:'#6a5234',legs:'#3a3024',boots:'#261b10',sleeve:'#424626',w:10.5,d:6,waist:8,head:'hood',hood:'#2f3a20',quiver:1}};
// A point of the hero's floor frame (facing ang) on screen, relative to the feet: [x, y].
function heroProj(ang,lx,ly,h){const c=Math.cos(ang),s=Math.sin(ang);return [lx*c-ly*s,(lx*s+ly*c)*TILT-h];}
// How far a point of the floor frame lies toward the camera (bigger = nearer, drawn later).
const heroNear=(ang,lx,ly)=>lx*Math.sin(ang)+ly*Math.cos(ang);
// The body sprite: feet at (0, HERO_FOOT) inside a sprite centred on the figure's middle.
const HERO_HALF=40,HERO_FOOT=30;
function heroBody(cls,d,f){const L=HERO_LOOK[cls]||HERO_LOOK.warden;
  return sprite(`hero25|${cls}|${d}|${f}|${TILT}`,HERO_HALF,x=>{x.translate(0,HERO_FOOT);paintHero(x,L,d*Math.PI/4,f);shadeHero(x);});}
// Light from above baked in (the figure never rotates on screen): a lit top, a darker bottom, only over its own pixels.
function shadeHero(x){x.save();x.globalCompositeOperation='source-atop';const g=x.createLinearGradient(0,-58,0,0);
  g.addColorStop(0,'rgba(255,232,200,.22)');g.addColorStop(0.35,'rgba(255,232,200,0)');g.addColorStop(0.6,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.38)');
  x.fillStyle=g;x.fillRect(-HERO_HALF,-60,HERO_HALF*2,64);x.restore();}
function paintHero(x,L,a,f){const P=(lx,ly,h)=>heroProj(a,lx,ly,h),c=Math.cos(a),s=Math.sin(a),front=s>-0.25,
    st=Math.sin(f/HERO_FR*TAU)*(f<0?0:1), // stride: -1..1 (f<0: standing)
    W=L.w,D=L.d,ext=(w,dd)=>Math.sqrt((dd*c)**2+(w*s)**2), // half-width on screen of an oval body slice
    line=(pts,w,col)=>{x.strokeStyle=col;x.lineWidth=w;x.lineCap='round';x.lineJoin='round';x.beginPath();x.moveTo(pts[0][0],pts[0][1]);for(let k=1;k<pts.length;k++)x.lineTo(pts[k][0],pts[k][1]);x.stroke();};
  // ---- legs: hip -> knee -> foot, the far one first; the swinging foot lifts a little
  const legs=[-1,1].map(side=>{const sw=st*side*7,lift=Math.max(0,-st*side)*2.5;
    return {near:heroNear(a,sw,side*3.6),pts:[P(0,side*3.8,22),P(sw*0.55+1.5,side*3.6,11+lift*0.5),P(sw,side*3.4,lift)],boot:[P(sw*0.9,side*3.4,6+lift),P(sw+2.5,side*3.4,lift)]};}).sort((p,q)=>p.near-q.near);
  for(const g of legs){line(g.pts,5.6,L.legs);line(g.boot,5.8,L.boots);}
  // ---- quiver on the back (behind the body when the hero faces the camera)
  const quiver=()=>{if(!L.quiver)return;const b=P(-D-1,-3,28),t=P(-D-3,-4,46);line([b,t],5.5,'#4a3018');
    for(let k=-1;k<=1;k++){const q=P(-D-3,-4+k*1.6,47);x.fillStyle='#d8d0bc';x.beginPath();x.arc(q[0],q[1]-1.5,1.4,0,TAU);x.fill();}};
  if(front)quiver();
  // ---- torso (and robe): a trapezoid from shoulders to waist, wider toward the camera's view of the shoulders
  const sh=ext(W,D),wa=ext(L.waist,D*0.9),top=-HERO_SH_H-1,mid=-22;
  x.fillStyle=L.torso;x.strokeStyle='rgba(0,0,0,.55)';x.lineWidth=1;
  if(L.robe){const hem=ext(W*1.25,D*1.2);x.beginPath();x.moveTo(-sh,top+2);x.lineTo(sh,top+2);x.lineTo(hem,-3);x.quadraticCurveTo(0,-1,-hem,-3);x.closePath();x.fill();
    x.strokeStyle='rgba(0,0,0,.35)';for(const k of [-0.45,0.1,0.6]){x.beginPath();x.moveTo(sh*k,mid);x.lineTo(hem*k*1.1,-3);x.stroke();}} // folds
  x.fillStyle=L.torso;x.beginPath();x.moveTo(-sh,top+2);x.quadraticCurveTo(-sh-1,top+9,-wa,mid);x.lineTo(wa,mid);x.quadraticCurveTo(sh+1,top+9,sh,top+2);x.quadraticCurveTo(0,top-1,-sh,top+2);x.fill();
  if(front){x.fillStyle=L.chest;x.beginPath();x.moveTo(-sh*0.55,top+3);x.lineTo(sh*0.55,top+3);x.lineTo(wa*0.6,mid);x.lineTo(-wa*0.6,mid);x.closePath();x.fill(); // chest panel
    x.strokeStyle=L.trim;x.lineWidth=1.2;x.beginPath();x.moveTo(-sh*0.35+c*2,top+3);x.lineTo(c*2,top+9);x.lineTo(sh*0.35+c*2,top+3);x.stroke();} // collar
  // belt
  x.fillStyle='#2a1c12';x.fillRect(-wa-0.5,mid-2.5,wa*2+1,3.5);if(front){x.fillStyle='#9a8048';x.fillRect(c*wa*0.5-1.5,mid-2.6,3,3.6);}
  if(L.pads)for(const side of [-1,1]){const q=P(0,side*(W-1),HERO_SH_H);x.fillStyle=L.pads;x.strokeStyle='#14100c';x.lineWidth=1.2;x.beginPath();x.ellipse(q[0],q[1]+1,4.6,3.6,0,0,TAU);x.fill();x.stroke();
    x.fillStyle='rgba(255,240,220,.18)';x.beginPath();x.ellipse(q[0]-0.8,q[1],2.4,1.4,0,0,TAU);x.fill();} // iron pauldrons
  if(!front)quiver();
  // ---- head: neck, then hair or hood, the face turned the way the hero looks
  const hc=P(0,0,47),hx=hc[0],hy=hc[1];
  x.fillStyle=L.skin;x.fillRect(hx-2,hy+4,4,4); // neck
  const hood=L.head==='hood'||L.head==='cowl';
  if(hood){x.fillStyle=L.hood;x.beginPath();x.arc(hx,hy,7.6,0,TAU);x.fill();if(L.head==='hood'){const tip=P(-6,0,55);x.beginPath();x.moveTo(hx-5,hy-4);x.lineTo(tip[0],tip[1]);x.lineTo(hx+5,hy-4);x.closePath();x.fill();}}
  else{x.fillStyle=L.hair;x.beginPath();x.arc(hx,hy,6.4,0,TAU);x.fill();}
  if(s>-0.55){ // the face shows unless the hero looks away from the camera
    const fx=hx+c*2.6,fy=hy+s*TILT*1.6+0.6,rw=4.2-Math.abs(c)*1.2;
    x.fillStyle=L.skin;x.beginPath();x.ellipse(fx,fy,rw,hood?4.4:5,0,0,TAU);x.fill();
    if(!hood){x.fillStyle=L.hair;x.beginPath();x.ellipse(fx-c*0.6,fy-4,rw+0.6,2.2,0,0,TAU);x.fill();} // hairline
    if(L.beard){x.fillStyle=L.hair;x.beginPath();x.ellipse(fx+c*0.5,fy+2.6,rw*0.9,2.4,0,0,TAU);x.fill();}
    x.fillStyle='#0c0806';const eye=k=>{const e=P(2,k*2.1,48.5);x.fillRect(e[0]-0.7,e[1]-0.6,1.4,1.3);};
    if(s>0.3){eye(-1);eye(1);}else eye(c>0?1:-1);}
  if(hood){x.strokeStyle='rgba(0,0,0,.45)';x.lineWidth=1;x.beginPath();x.arc(hx,hy,7.6,0,TAU);x.stroke();}}
// Weapons rise out of the floor plane: at rest they point up and out (a ready stance), through a blow they sweep
// down flat. HERO_EL.E is the angle above the floor (0 = flat, the top-down pose); render.js heroHands calls heroRaise
// right after turning to a weapon's angle g, inside held() below (floor frame: scale K, K*TILT, turned by the facing).
const HERO_EL={E:0,Ey:0,ang:0};
// Ey raises the other axis instead (a bow stands upright across the shot).
function heroRaise(g){const E=HERO_EL.E,Ey=HERO_EL.Ey,a=HERO_EL.ang,s=Math.sin(a),c=Math.cos(a),vx=-s/TILT,vy=-c/TILT,cg=Math.cos(g),sg=Math.sin(g),
    ux=vx*cg+vy*sg,uy=-vx*sg+vy*cg; // straight up, in the weapon's own frame (per unit of the floor frame)
  ctx.transform(Math.cos(E)+Math.sin(E)*ux,Math.sin(E)*uy,Math.sin(Ey)*ux,Math.cos(Ey)+Math.sin(Ey)*uy,0,0);} // each axis: cos along the floor + sin straight up
// How high a weapon is held: high at rest, flat at the moment of a blow; bows level when shooting.
// Heavy blows lift the weapon overhead on the wind-up and slam it down past flat; casting lifts a staff higher.
function heroElev(W,A,S,spin,u){if(!W||W.bow||spin)return 0;const rest=W.anim==='thrust'?1.05:W.hands===2?0.95:0.85;if(!A)return rest;
  if(A.style==='heavy')return u<0.35?rest+(1.5-rest)*(u/0.35):1.5-1.7*Math.min(1,(u-0.35)/0.3)+Math.max(0,(u-0.65)/0.35)*(rest+0.2);
  if(A.style==='cast')return rest+0.35*S;
  return rest*(1-S);}
// Where each hand is (floor frame), matching render.js heroHands.
function heroHandSpots(W,off,A,u,S,spin){
  if(W&&W.hands===2){const staff=W.anim==='thrust';let gx=staff?5:6,gy=staff?11:9,ang=staff?0.2:0.7;
    if(spin)ang=1.3;else if(A){if(A.style==='heavy'){ang=heavyAng(u);gx+=S*4;}else if(A.style==='thrust')gx+=S*10;else if(A.style==='swing')ang=1.4-(1-(1-u)*(1-u))*2.3;}
    const c=Math.cos(ang),s=Math.sin(ang),h1=staff?0:-1,h2=staff?-9:-8;return {mh:[gx+c*h1,gy+s*h1],oh:[gx+c*h2,gy+s*h2],two:1,grip:[gx,gy],g:ang,h2};}
  const pose=(side,h)=>spin?[6,12*side,side*1.3]:A&&A.hand===h?handPose(A.style,u,side):[5,12*side,side*0.5];
  const [x,y]=pose(1,'mh');let oh=[5,-12];
  if(W&&W.bow&&A)oh=[x-4-S*4,y-2];else if(off&&off.slot==='weapon')oh=pose(-1,'oh');else if(off&&off.slot==='focus')oh=[6,-12];else if(off&&off.slot==='shield')oh=[9,-13];
  return {mh:[x,y],oh};}
// The hero, standing on the angled floor. Called by drawPlayer inside render.js upr (upright around the feet).
function drawHero25(){const p=G.p,C2=G.char,L=HERO_LOOK[C2.cls]||HERO_LOOK.warden,K=HERO_K;let z=0;if(p.leap)z=Math.sin(Math.min(1,p.leap.t/p.leap.dur)*Math.PI)*40;
  const eq=C2.equip,mw=eq.mainhand&&eq.mainhand.slot==='weapon'?eq.mainhand:null,off=eq.offhand,W=mw?WEAPONS[mw.wt]||FIST:null;
  const A=p.atk,u=A?Math.min(1,A.t/A.dur):0,S=Math.sin(u*Math.PI),spin=p.spin>0;
  const ang=spin?G.time*20:p.face,c=Math.cos(ang),s=Math.sin(ang);
  // walking: a stride phase from the distance moved; standing still: frame -1 (feet together) and a slow breath
  const dx=p.x-(p._hx??p.x),dy=p.y-(p._hy??p.y),mv=Math.hypot(dx,dy);p._hx=p.x;p._hy=p.y;
  if(mv>0.05){p._hw=((p._hw||0)+mv/34)%1;p._hs=0.25;}else p._hs=Math.max(0,(p._hs||0)-1/60);
  const f=p._hs>0&&!p.dead?Math.floor(p._hw*HERO_FR)%HERO_FR:-1;
  const d=((Math.round(ang/(Math.PI/4))%8)+8)%8,body=heroBody(C2.cls,d,f);
  const push=(A?S*4:0)-(p.hurt>0?p.hurt*10:0),ox=c*push,oy=s*push*TILT; // lean into a blow, rock back when hit
  const breath=f<0&&!A?Math.sin(G.time*2.2)*0.6:0;
  const fx=p.x+ox,fy=p.y+oy-z; // the feet this frame
  const alpha=p.dead?0.4:p.dodge?0.55:1;
  if(p.dead){ctx.save();ctx.globalAlpha=0.45;ctx.translate(fx,fy);ctx.rotate(c>=0?-1.45:1.45);ctx.drawImage(body,-HERO_HALF,-HERO_HALF-HERO_FOOT,HERO_HALF*2,HERO_HALF*2);ctx.restore();return;} // fallen over
  // rings at the feet: slowed, buffed
  if(p.slowT>0||p.buffT>0){ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,TILT);
    if(p.slowT>0){ctx.strokeStyle='#9fdcff';ctx.globalAlpha=0.6;ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(0,0,p.r+6,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    if(p.buffT>0){ctx.strokeStyle='#ffcc55';ctx.globalAlpha=0.5+Math.sin(G.time*8)*0.2;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,p.r+9,0,TAU);ctx.stroke();}ctx.restore();}
  const HH=heroHandSpots(W,off,A,u,S,spin);
  // one side: its arm (shoulder to hand) and what that hand holds, drawn in the floor frame lifted to hand height
  const arm=(side,spot,lift)=>{const sh=heroProj(ang,0,side*(L.w-1.5),HERO_SH_H-2+breath),hd=heroProj(ang,spot[0]*K,spot[1]*K,HERO_HAND_H*K+(lift||0)),
      el=[(sh[0]+hd[0])/2-c*1.5,(sh[1]+hd[1])/2+2];
    ctx.strokeStyle='#120c08';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=6.4;ctx.beginPath();ctx.moveTo(fx+sh[0],fy+sh[1]);ctx.lineTo(fx+el[0],fy+el[1]);ctx.lineTo(fx+hd[0],fy+hd[1]);ctx.stroke();
    ctx.strokeStyle=L.sleeve;ctx.lineWidth=4.4;ctx.stroke();};
  const E=heroElev(W,A,S,spin,u),Ey=W&&W.bow?1.25:0; // bows: held upright
  if(HH.two&&E){const ce=Math.cos(E),gc=Math.cos(HH.g),gs=Math.sin(HH.g);HH.oh=[HH.grip[0]+gc*HH.h2*ce,HH.grip[1]+gs*HH.h2*ce];HH.lift=HH.h2*Math.sin(E)*K;} // the second hand slides down the raised grip
  const held=part=>{ctx.save();ctx.translate(fx,fy-HERO_HAND_H*K);ctx.scale(K,K*TILT);ctx.rotate(ang);HERO_EL.E=E;HERO_EL.Ey=Ey;HERO_EL.ang=ang;try{heroHands(part,C2,W,mw,off,A,u,S,spin,{});}finally{HERO_EL.E=HERO_EL.Ey=0;ctx.restore();}};
  const mhNear=heroNear(ang,HH.mh[0],HH.mh[1])>=0,ohNear=heroNear(ang,HH.oh[0],HH.oh[1])>=0;
  // the main-hand item (and a two-hander's grip) belongs to the main side; the off-hand item to the off side
  const group=main=>{if(main){arm(1,HH.mh);if(HH.two)arm(-1,HH.oh,HH.lift);held(1);}else{arm(-1,HH.oh);held(-1);}};
  const G2=[{main:true,near:mhNear}];if(!HH.two)G2.push({main:false,near:ohNear});
  ctx.save();if(alpha<1)ctx.globalAlpha=alpha;
  for(const g of G2)if(!g.near)group(g.main);
  ctx.drawImage(body,fx-HERO_HALF,fy-HERO_FOOT-HERO_HALF-breath*0.5,HERO_HALF*2,HERO_HALF*2);
  for(const g of G2)if(g.near)group(g.main);
  if(playerFrozen()){ctx.fillStyle='rgba(150,210,255,.30)';ctx.strokeStyle='rgba(225,245,255,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(fx,fy-28,16,32,0,0,TAU);ctx.fill();ctx.stroke();} // ailments.js
  ctx.restore();}
