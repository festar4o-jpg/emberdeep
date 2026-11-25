// The Ranger's moving parts (v1.0.125): Spike Trap and Rain of Arrows live in G.skz (cleared with the area) and are
// ticked by skillalts.js skzTick through RZ[kind]. The skills themselves are in skills.js (SKILLS.ranger).
const TRAP_ARM=0.5,TRAP_LIFE=15,TRAP_MAX=3,TRAP_R=110,TRAP_TRIG=46,RAIN_R=130,RAIN_T=2,RAIN_HITS=6;
// Spike Trap: thrown to a spot; armed after TRAP_ARM s, it springs when an enemy steps close: a burst that Stuns.
function placeTrap(x,y,m,stun,sk){const own=G.skz.filter(z=>z.k==='trap');if(own.length>=TRAP_MAX)own[0].t=0; // the oldest one goes
  G.skz.push({k:'trap',x,y,t:TRAP_LIFE,arm:TRAP_ARM,m,stun,sk,fx:0});G.fx.push({type:'ring',x,y,r0:6,r1:24,t:0,max:0.3,col:'#c8b088'});}
// Rain of Arrows: RAIN_HITS volleys over RAIN_T s on a circle.
function rainAt(x,y,m,sk){G.skz.push({k:'rain',x,y,t:RAIN_T,tick:RAIN_T/RAIN_HITS,m,sk});G.fx.push({type:'tele',x,y,r:RAIN_R,t:0,max:RAIN_T,col:'#c8b088',own:1});}
const RZ={
  trap(z,p,dt){if(z.arm>0){z.arm-=dt;return;}
    z.fx-=dt;if(z.fx<=0){z.fx=0.6;G.fx.push({type:'ring',x:z.x,y:z.y,r0:14,r1:20,t:0,max:0.4,col:'#9a8a6a'});}
    const e=G.enemies.find(e=>!e.dead&&!e.hidden&&Math.hypot(e.x-z.x,e.y-z.y)<TRAP_TRIG+e.r);
    if(e){z.t=0;aoe(z.x,z.y,TRAP_R,z.m,{stun:z.stun,kb:60});fxCracks(z.x,z.y,TRAP_R*0.8);burst(z.x,z.y,26,'#d8d0c0',260);G.fx.push({type:'ring',x:z.x,y:z.y,r0:10,r1:TRAP_R,t:0,max:0.35,col:'#e8dcc4'});
      G.shake=Math.max(G.shake,7);playSfx('slam');}},
  rain(z,p,dt){z.tick-=dt;if(fr(0,1)<0.9)part(z.x+fr(-RAIN_R,RAIN_R)*0.8,z.y+fr(-RAIN_R,RAIN_R)*0.8-40,0,260,0.16,'#e8dcc4',2);
    if(z.tick<=0&&z.t>-0.01){z.tick+=RAIN_T/RAIN_HITS;aoe(z.x,z.y,RAIN_R,z.m,{weapon:true,quiet:true});burst(z.x,z.y,6,'#c8b088',120);}}};
// ---------- Call of the Wild (v1.0.126): the wolf ----------
// G.pets: the hero's companions (kept across areas, not saved: call it again after a restart). A wolf follows you,
// runs at the nearest enemy near you and bites it (your weapon damage, so it grows with your gear; faster with your
// Attack Speed), takes hits from monsters it fights, regenerates, and dies when its Life runs out. Calling it again
// while it lives heals it fully. Ticked in game.js update (petTick), drawn in render.js (drawPet).
const WOLF_SPD=215,WOLF_R=12,WOLF_BITE=1,WOLF_LEASH=260,WOLF_FAR=620;
function wolfLife(r){return Math.round(G.stats.life*(0.4+0.03*(r-1)));}
function callWolf(r){const p=G.p;if(!G.pets)G.pets=[];let w=G.pets.find(q=>q.kind==='wolf');const life=wolfLife(r);
  if(w){w.maxHp=life;w.hp=life;w.m=0.8+0.1*(r-1);floatText(w.x,w.y-20,'Healed','#7fe07f',false);}
  else{let x=p.x-Math.cos(p.face)*30,y=p.y-Math.sin(p.face)*30;if(blockedAt(x,y,WOLF_R)){x=p.x;y=p.y;}
    w={kind:'wolf',x,y,r:WOLF_R,hp:life,maxHp:life,m:0.8+0.1*(r-1),face:p.face,bite:0,walk:0,hurt:0};G.pets.push(w);}
  G.fx.push({type:'ring',x:w.x,y:w.y,r0:6,r1:60,t:0,max:0.4,col:'#c8c0b0'});burst(w.x,w.y,16,'#bfb8a8',180);}
function petTick(dt){if(!G.pets||!G.pets.length)return;const p=G.p;
  for(const w of G.pets){if(w.hp<=0)continue;w.hurt=Math.max(0,w.hurt-dt);w.bite-=dt;w.hp=Math.min(w.maxHp,w.hp+w.maxHp*0.02*dt);
    const dp=Math.hypot(p.x-w.x,p.y-w.y);if(dp>WOLF_FAR||G.inTown&&dp>200){w.x=p.x;w.y=p.y;} // left behind (a new area, a portal): back at your side
    const t=G.inTown?null:nearest(p.x,p.y,WOLF_LEASH);let gx=p.x-Math.cos(p.face)*34,gy=p.y-Math.sin(p.face)*34;
    if(t){const reach=t.r+w.r+6,d=Math.hypot(t.x-w.x,t.y-w.y);gx=t.x;gy=t.y;w.face=Math.atan2(t.y-w.y,t.x-w.x);
      if(d<=reach){gx=w.x;gy=w.y;if(w.bite<=0){w.bite=WOLF_BITE/(1+(G.stats.aspd||0)/100);const sk=G.sk;G.sk=3;hitEnemy(t,w.m,{weapon:true,kb:20});G.sk=sk;gainRes(1);burst(t.x,t.y,5,'#c8c0b0',100);}}}
    const dx=gx-w.x,dy=gy-w.y,dd=Math.hypot(dx,dy);if(dd>8){const st=Math.min(dd,WOLF_SPD*(t?1.15:dp>120?1.3:1)*dt);moveEnt(w,dx/dd*st,dy/dd*st);w.walk+=st;if(!t)w.face=Math.atan2(dy,dx);}
    // monsters next to it hit it now and then (every one of their attack times)
    for(const e of G.enemies){if(e.dead||e.hidden||!e.aggro||!(e.dmg>0))continue;if(Math.hypot(e.x-w.x,e.y-w.y)>e.r+w.r+8){continue;}
      e.wolfT=(e.wolfT||0)-dt;if(e.wolfT<=0){e.wolfT=(ETYPES[e.type].cd||1.4)*1.3;w.hp-=e.dmg*0.6;w.hurt=0.15;if(w.hp<=0)break;}}
    if(w.hp<=0){burst(w.x,w.y,20,'#8a8070',200);floatText(w.x,w.y-20,'Your wolf falls','#c8b088',false);}}
  G.pets=G.pets.filter(w=>w.hp>0);}
// The wolf, side-on from above: body, head with ears and snout, a tail, legs that move as it runs; flashes when hit.
function drawPet(w){const x=ctx;x.save();x.translate(w.x,w.y);x.rotate(w.face);const leg=Math.sin(w.walk*0.18)*4,body=w.hurt>0?'#e8d0c8':'#7a7468',dark='#4a463e';
  x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.ellipse(0,4,15,7,0,0,TAU);x.fill();
  x.strokeStyle=dark;x.lineWidth=3;x.lineCap='round';for(const [lx,s] of [[7,1],[-7,-1]])for(const sd of [-1,1]){x.beginPath();x.moveTo(lx,sd*5);x.lineTo(lx+leg*s*sd,sd*10);x.stroke();}
  x.strokeStyle=body;x.lineWidth=4;x.beginPath();x.moveTo(-12,0);x.quadraticCurveTo(-20,-3+leg*0.5,-24,2);x.stroke(); // tail
  x.fillStyle=body;x.beginPath();x.ellipse(0,0,13,7,0,0,TAU);x.fill();x.fillStyle=dark;x.beginPath();x.ellipse(-2,0,8,3,0,0,TAU);x.fill();
  x.fillStyle=body;x.beginPath();x.ellipse(13,0,6.5,5.5,0,0,TAU);x.fill();x.beginPath();x.moveTo(17,-2.5);x.lineTo(23,0);x.lineTo(17,2.5);x.fill(); // head, snout
  x.fillStyle=dark;for(const sd of [-1,1]){x.beginPath();x.moveTo(11,sd*3);x.lineTo(9,sd*8);x.lineTo(14,sd*4);x.fill();} // ears
  x.fillStyle='#ffd36b';for(const sd of [-1,1]){x.beginPath();x.arc(16,sd*2.2,1,0,TAU);x.fill();}x.restore();
  if(w.hp<w.maxHp){const W=26,f=Math.max(0,w.hp/w.maxHp);ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(w.x-W/2,w.y-20,W,3);ctx.fillStyle='#7fd07f';ctx.fillRect(w.x-W/2,w.y-20,W*f,3);}}
