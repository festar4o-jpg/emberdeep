// The Ranger's moving parts (v1.0.125): Spike Trap and Rain of Arrows live in G.skz (cleared with the area) and are
// ticked by skillalts.js skzTick through RZ[kind]. The skills themselves are in skills.js (SKILLS.ranger).
const TRAP_ARM=0.5,TRAP_LIFE=15,TRAP_MAX=3,TRAP_R=120,TRAP_TRIG=46,RAIN_R=150,RAIN_T=2,RAIN_HITS=6;
// Spike Trap: thrown to a spot; armed after TRAP_ARM s, it springs when an enemy steps close: a burst that Stuns.
// v1.0.128 modifiers (skillmods.js): Cluster Traps (3 at once, up to 6), Hair Trigger (armed at once, springs from 50% further), Lacerating Trap (Bleed).
const trapMax=()=>hasMod('trCluster')?TRAP_MAX*2:TRAP_MAX;
function placeTrap(x,y,m,stun,sk,fire){ /* fire: Fire Trap's burning-ground damage (v1.0.129) */hintRanger('trap');const own=G.skz.filter(z=>z.k==='trap'&&z.t>0);if(own.length>=trapMax())own[0].t=0; // the oldest one goes
  const qf=!!fire&&hasMod('ftQuick'),hair=hasMod('trHair')||qf;if(qf){m*=0.75;fire*=0.75;} /* Quick Fuse */
  G.skz.push({k:'trap',x,y,t:TRAP_LIFE,wild:!!fire&&hasMod('ftWild'),arm:hair?0:TRAP_ARM,trig:TRAP_TRIG*(hair?1.5:1),bleed:!fire&&hasMod('trBarb'),fire:fire||0,m,stun,sk,fx:0});G.fx.push({type:'ring',x,y,r0:6,r1:24,t:0,max:0.3,col:'#c8b088'});}
// Rain of Arrows: RAIN_HITS volleys over RAIN_T s on a circle. v1.0.128: Arrow Storm (twice as long), Pinning Rain (slows), Downpour (smaller, harder).
function rainAt(x,y,m,sk){const fol=hasPw('rainFollow'),T=RAIN_T*(hasMod('rnStorm')?2:1)+(fol?1:0),dn=hasMod('rnDown'),R=RAIN_R*(dn?0.7:1); /* uniques.js: Quiver of Endless Rain */
  if(fol){x=G.p.x;y=G.p.y;}G.skz.push({k:'rain',x,y,t:T,tick:RAIN_T/RAIN_HITS,R,pin:hasMod('rnPin'),follow:fol,m:m*(dn?1.6:1),sk});if(!fol)G.fx.push({type:'tele',x,y,r:R,t:0,max:T,col:'#c8b088',own:1});}
const RZ={
  trap(z,p,dt){if(z.arm>0){z.arm-=dt;return;}
    const e=z.force?z:G.enemies.find(e=>!e.dead&&!e.hidden&&Math.hypot(e.x-z.x,e.y-z.y)<(z.trig||TRAP_TRIG)+e.r); /* force: set off by another (Snaretooth Grips) */
    if(e&&hasPw('trapChain'))for(const o of G.skz)if(o!==z&&o.k==='trap'&&o.t>0&&!o.force&&Math.hypot(o.x-z.x,o.y-z.y)<250){o.arm=0;o.force=true;}
    if(e&&z.fire){z.t=0;aoe(z.x,z.y,TRAP_R,z.m,{kb:30});G.hazards.push({sk:z.sk,x:z.x,y:z.y,r:FTRAP_R*(z.wild?1.5:1),t:z.wild?6:FTRAP_T,tick:0.25,mult:z.fire}); /* Wildfire */fxExplosion(z.x,z.y,TRAP_R,'#ff8a2a');G.shake=Math.max(G.shake,7);playSfx('boom');return;}
    if(e){z.t=0;aoe(z.x,z.y,TRAP_R,z.m,{stun:z.stun,kb:60,bleed:z.bleed});fxCracks(z.x,z.y,TRAP_R*0.8);burst(z.x,z.y,26,'#d8d0c0',260);G.fx.push({type:'ring',x:z.x,y:z.y,r0:10,r1:TRAP_R,t:0,max:0.35,col:'#e8dcc4'});
      G.shake=Math.max(G.shake,7);playSfx('snap');}},
  rain(z,p,dt){const R=z.R||RAIN_R;if(z.follow){z.x=p.x;z.y=p.y;}z.tick-=dt;if(fr(0,1)<0.9)part(z.x+fr(-R,R)*0.8,z.y+fr(-R,R)*0.8-40,0,260,0.16,'#e8dcc4',2);
    if(z.pin)for(const e of G.enemies)if(!e.dead&&!e.hidden&&Math.hypot(e.x-z.x,e.y-z.y)<R+e.r)chillHit(e,0.4,0.3,true); // Pinning Rain
    if(z.tick<=0&&z.t>-0.01){z.tick+=RAIN_T/RAIN_HITS;aoe(z.x,z.y,R,z.m,{weapon:true,quiet:true});burst(z.x,z.y,6,'#c8b088',120);}}};
// ---------- Call of the Wild (v1.0.126): the wolf ----------
// G.pets: the hero's companions (kept across areas, not saved: call it again after a restart). A wolf follows you,
// runs at the nearest enemy near you and bites it (your weapon damage, so it grows with your gear; faster with your
// Attack Speed), takes hits from monsters it fights, regenerates, and dies when its Life runs out. Calling it again
// while it lives heals it fully. Ticked in game.js update (petTick), drawn in render.js (drawPet).
const WOLF_SPD=215,WOLF_R=12,WOLF_BITE=1,WOLF_LEASH=260,WOLF_FAR=620;
function wolfLife(r){return Math.round(G.stats.life*(0.4+0.03*(r-1)));}
// v1.0.128 modifiers (skillmods.js): Pack (two wolves, 60% Life, 70% damage), Alpha (one big wolf, twice the Life, +40% damage), Bond (ranger.js bites, modTakenMul).
function callWolf(r){const p=G.p;if(!G.pets)G.pets=[];hintRanger('wolf');const pack=hasMod('wfPack'),alpha=hasMod('wfAlpha'),n=pack?2:1;
  const life=Math.round(wolfLife(r)*(pack?0.6:alpha?2:1)*(hasPerk('thickHide')?1.6:1)*(hasPw('wolfFang')?1.3:1)) /* subclasses.js: Thick Hide; uniques.js: The Wolfmother's Fang */,m=(0.8+0.1*(r-1))*(pack?0.7:alpha?1.4:1);
  for(const q of G.pets)if(q.kind==='hawk')q.hp=0; /* a hawk or wolves, not both */let ws=G.pets.filter(q=>q.kind==='wolf');for(const w of ws.slice(n))w.hp=0;ws=ws.slice(0,n);G.pets=G.pets.filter(q=>q.hp>0);
  for(const w of ws){w.maxHp=life;w.hp=life;w.m=m;w.big=alpha;floatText(w.x,w.y-20,'Healed','#7fe07f',false);}
  while(ws.length<n){const k=ws.length,b=p.face+Math.PI+(n>1?(k?0.6:-0.6):0);let x=p.x+Math.cos(b)*30,y=p.y+Math.sin(b)*30;if(blockedAt(x,y,WOLF_R)){x=p.x;y=p.y;}
    const w={kind:'wolf',x,y,r:WOLF_R*(alpha?1.3:1),hp:life,maxHp:life,m,big:alpha,face:p.face,bite:0,walk:0,hurt:0};G.pets.push(w);ws.push(w);}
  for(const w of ws){G.fx.push({type:'ring',x:w.x,y:w.y,r0:6,r1:60,t:0,max:0.4,col:'#c8c0b0'});burst(w.x,w.y,16,'#bfb8a8',180);}}
function petTick(dt){if(!G.pets||!G.pets.length)return;const p=G.p;
  let wi=0;for(const w of G.pets){if(w.hp<=0)continue;if(w.kind==='hawk'){hawkTick(w,dt);continue;}const side=wi++?1:-1;w.hurt=Math.max(0,w.hurt-dt);w.bite-=dt;w.hp=Math.min(w.maxHp,w.hp+w.maxHp*(hasPerk('thickHide')?0.06:0.02)*dt);
    const dp=Math.hypot(p.x-w.x,p.y-w.y);if(dp>WOLF_FAR||G.inTown&&dp>200){w.x=p.x;w.y=p.y;} // left behind (a new area, a portal): back at your side
    const t=G.inTown?null:nearest(p.x,p.y,WOLF_LEASH);let gx=p.x-Math.cos(p.face+side*0.5)*34,gy=p.y-Math.sin(p.face+side*0.5)*34;
    if(t){const reach=t.r+w.r+6,d=Math.hypot(t.x-w.x,t.y-w.y);gx=t.x;gy=t.y;w.face=Math.atan2(t.y-w.y,t.x-w.x);
      if(d<=reach){gx=w.x;gy=w.y;if(w.bite<=0){w.bite=WOLF_BITE/(1+(G.stats.aspd||0)/100);const sk=G.sk;G.sk=3;hitEnemy(t,w.m*petMul(),{weapon:true,kb:20,bleed:hasPw('wolfFang')});G.sk=sk;petKill(t);if(hasPw('wildHunt'))gainRes(3); /* subclasses.js: Pack Leader, Alpha Roar */gainRes(1);if(hasMod('wfBond'))healPlayer(G.stats.life*0.005,true);burst(t.x,t.y,5,'#c8c0b0',100);if(fr(0,1)<0.5)playSfx('bite');}}}
    const dx=gx-w.x,dy=gy-w.y,dd=Math.hypot(dx,dy);if(dd>8){const st=Math.min(dd,WOLF_SPD*(t?1.15:dp>120?1.3:1)*dt);moveEnt(w,dx/dd*st,dy/dd*st);w.walk+=st;if(!t)w.face=Math.atan2(dy,dx);}
    // monsters next to it hit it now and then (every one of their attack times)
    for(const e of G.enemies){if(e.dead||e.hidden||!e.aggro||!(e.dmg>0))continue;if(Math.hypot(e.x-w.x,e.y-w.y)>e.r+w.r+8){continue;}
      e.wolfT=(e.wolfT||0)-dt;if(e.wolfT<=0){e.wolfT=(ETYPES[e.type].cd||1.4)*1.3;w.hp-=e.dmg*0.6;w.hurt=0.15;if(w.hp<=0)break;}}
    if(w.hp<=0){burst(w.x,w.y,20,'#8a8070',200);floatText(w.x,w.y-20,'Your wolf falls','#c8b088',false);}}
  G.pets=G.pets.filter(w=>w.hp>0);}
// The wolf, side-on from above: body, head with ears and snout, a tail, legs that move as it runs; flashes when hit.
function drawPet(w){if(w.kind==='hawk')return drawHawk(w);const x=ctx;x.save();x.translate(w.x,w.y);x.rotate(w.face);if(w.big)x.scale(1.3,1.3); /* Alpha */const leg=Math.sin(w.walk*0.18)*4,body=w.hurt>0?'#e8d0c8':'#7a7468',dark='#4a463e';
  x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.ellipse(0,4,15,7,0,0,TAU);x.fill();
  x.strokeStyle=dark;x.lineWidth=3;x.lineCap='round';for(const [lx,s] of [[7,1],[-7,-1]])for(const sd of [-1,1]){x.beginPath();x.moveTo(lx,sd*5);x.lineTo(lx+leg*s*sd,sd*10);x.stroke();}
  x.strokeStyle=body;x.lineWidth=4;x.beginPath();x.moveTo(-12,0);x.quadraticCurveTo(-20,-3+leg*0.5,-24,2);x.stroke(); // tail
  x.fillStyle=body;x.beginPath();x.ellipse(0,0,13,7,0,0,TAU);x.fill();x.fillStyle=dark;x.beginPath();x.ellipse(-2,0,8,3,0,0,TAU);x.fill();
  x.fillStyle=body;x.beginPath();x.ellipse(13,0,6.5,5.5,0,0,TAU);x.fill();x.beginPath();x.moveTo(17,-2.5);x.lineTo(23,0);x.lineTo(17,2.5);x.fill(); // head, snout
  x.fillStyle=dark;for(const sd of [-1,1]){x.beginPath();x.moveTo(11,sd*3);x.lineTo(9,sd*8);x.lineTo(14,sd*4);x.fill();} // ears
  x.fillStyle='#ffd36b';for(const sd of [-1,1]){x.beginPath();x.arc(16,sd*2.2,1,0,TAU);x.fill();}x.restore();
  if(w.hp<w.maxHp){const W=26,f=Math.max(0,w.hp/w.maxHp);ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(w.x-W/2,w.y-20,W,3);ctx.fillStyle='#7fd07f';ctx.fillRect(w.x-W/2,w.y-20,W*f,3);}}
// v1.0.127: traps on the floor (render.js, under everything that moves): an iron jaw with spikes; red glints once armed.
function drawTraps(onScreen){if(!G.skz)return;onScreen=onScreen||(()=>true);for(const z of G.skz){if(z.k!=='trap'||!onScreen(z.x,z.y,30))continue;const armed=!(z.arm>0);ctx.save();ctx.translate(z.x,z.y);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(0,3,17,8,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#4a4a46';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,13,0,TAU);ctx.stroke();ctx.fillStyle='#2a2826';ctx.beginPath();ctx.arc(0,0,5,0,TAU);ctx.fill();
  ctx.fillStyle=z.fire?(armed?'#e0a060':'#7a5a40'):armed?'#bfc6cc':'#6e6a64';for(let k=0;k<8;k++){const a=k/8*TAU;ctx.beginPath();ctx.moveTo(Math.cos(a)*11,Math.sin(a)*11);ctx.lineTo(Math.cos(a+0.18)*17,Math.sin(a+0.18)*17);ctx.lineTo(Math.cos(a+0.36)*11,Math.sin(a+0.36)*11);ctx.fill();}
  if(armed){ctx.globalAlpha=0.5+0.4*Math.sin(G.time*6+z.x);ctx.fillStyle=z.fire?'#ffb03a':'#ff5a3a';ctx.beginPath();ctx.arc(0,0,z.fire?3.4:2.4,0,TAU);ctx.fill();ctx.globalAlpha=1;}ctx.restore();}}
// ---------- v1.0.129: the second skills' moving parts (skillalts.js SKILL_ALTS.ranger) ----------
const FTRAP_R=100,FTRAP_T=4,VAULT_D=210,CALTROP_R=80,CALTROP_T=4,HAWK_T=20,HAWK_SPD=620,HAWK_EVERY=1.6,MARK_T=4,BOMB_T=1.2,BOMB_R=120;
// Vault: a flip away from the nearest enemy (or backwards), through the air like Leap Slam (no hits taken), caltrops left behind.
// v1.0.130: Long Vault, Parting Shot (vaultLand, game.js), Spiked Field.
function vault(r){const p=G.p,t=nearest(p.x,p.y,300),a=t?Math.atan2(p.y-t.y,p.x-t.x):p.face+Math.PI,D=VAULT_D*(hasMod('vtFar')?1.5:1),fl=hasMod('vtField');let tx=p.x+Math.cos(a)*D,ty=p.y+Math.sin(a)*D;
  for(let k=0;k<20&&blockedAt(tx,ty,p.r);k++){tx-=(tx-p.x)*0.15;ty-=(ty-p.y)*0.15;}
  G.skz.push({k:'caltrop',x:p.x,y:p.y,t:CALTROP_T*(fl?2:1),R:CALTROP_R*(fl?1.5:1),tick:0,m:(0.35+0.04*(r-1))*(fl?1.5:1),sk:G.sk});
  p.leap={sx:p.x,sy:p.y,tx,ty,t:0,dur:0.34,vault:true,shot:hasMod('vtShot')?0.5*(1+0.12*(r-1)):0,sk:G.sk};p.face=a+Math.PI;burst(p.x,p.y,10,'#8a8070',140);}
Object.assign(RZ,{
  caltrop(z,p,dt){const R=z.R||CALTROP_R;z.tick-=dt;for(const e of G.enemies)if(!e.dead&&!e.hidden&&Math.hypot(e.x-z.x,e.y-z.y)<R+e.r)chillHit(e,0.5,0.3,true);
    if(z.tick<=0){z.tick=0.5;aoe(z.x,z.y,R,z.m,{quiet:true});}},
  bomb(z,p,dt){const e=z.e;if(e&&!e.dead){z.x=e.x+z.ox;z.y=e.y+z.oy;}
    if(fr(0,1)<0.7)part(z.x,z.y-4,fr(-20,20),-60,0.3,'#ffb03a',2);
    if(z.t<=0){const R=z.R||BOMB_R;aoe(z.x,z.y,R,z.m,{kb:50});fxExplosion(z.x,z.y,R,'#ff8a2a');
      if(z.cluster)for(let k=0;k<3;k++){const b=fr(0,TAU)+k*TAU/3;G.skz.push({k:'bomb',e:null,x:z.x+Math.cos(b)*80,y:z.y+Math.sin(b)*80,t:0.5,T:0.5,R:70,m:z.m*0.4,sk:z.sk});} /* Cluster Bomb */G.shake=Math.max(G.shake,9);G.hitStop=0.04;playSfx('boom');}}});
// Explosive Arrow: the arrow sticks where it hit the enemy
// v1.0.130: Short Fuse, Cluster Bomb, Payload
function stickBomb(e,m,sk){const a=fr(0,TAU),T=hasMod('exQuick')?0.4:BOMB_T;G.skz.push({k:'bomb',e,ox:Math.cos(a)*e.r*0.5,oy:Math.sin(a)*e.r*0.5,x:e.x,y:e.y,t:T,T,R:BOMB_R*(hasMod('exPayload')?1.5:1),cluster:hasMod('exCluster'),m,sk});}
// Hawk: lasts HAWK_T s; circles you, dives at an enemy near you, hits and Marks it, flies back up. Can't be hurt.
function callHawk(r){const p=G.p;if(!G.pets)G.pets=[];for(const q of G.pets)if(q.kind==='wolf')q.hp=0;G.pets=G.pets.filter(q=>q.hp>0);
  let h=G.pets.find(q=>q.kind==='hawk');if(!h){h={kind:'hawk',x:p.x,y:p.y-40,hp:1,maxHp:1,r:8,ang:0,dive:null,cd:0.4,walk:0,face:0};G.pets.push(h);}
  const tal=hasMod('hkTalon'),prey=hasMod('hkPrey'); /* v1.0.130: Razor Talons, Swift Wings, Hunter's Mark */
  Object.assign(h,{t:HAWK_T,m:(0.7+0.07*(r-1))*(tal?1.4:1),bleed:tal,every:HAWK_EVERY*(hasMod('hkSwift')?0.5:1),markT:MARK_T*(prey?2:1),mark:(0.15+0.01*(r-1))*(prey?1.5:1)});G.fx.push({type:'ring',x:p.x,y:p.y,r0:6,r1:60,t:0,max:0.4,col:'#d8c8a0'});}
function hawkTick(h,dt){const p=G.p;h.t-=dt;h.walk+=dt;if(h.t<=0){h.hp=0;burst(h.x,h.y,10,'#c8b088',120);return;}
  h.cd-=dt;let gx,gy;
  if(h.dive&&(h.dive.dead||h.dive.hidden))h.dive=null;
  if(h.dive){const e=h.dive;gx=e.x;gy=e.y;if(Math.hypot(e.x-h.x,e.y-h.y)<e.r+10){const sk=G.sk;G.sk=3;hitEnemy(e,h.m*petMul(),{weapon:true,kb:10,bleed:h.bleed});G.sk=sk;petKill(e);if(hasPw('wildHunt'))gainRes(3);
      e.markAmt=Math.max(e.markUntil>G.time&&e.markAmt||0,h.mark);e.markUntil=G.time+(h.markT||MARK_T);burst(e.x,e.y,8,'#e8d8a8',140);h.dive=null;h.cd=(h.every||HAWK_EVERY)/(1+(G.stats.aspd||0)/100);}}
  else{h.ang+=dt*2.4;gx=p.x+Math.cos(h.ang)*55;gy=p.y+Math.sin(h.ang)*30-30;
    if(h.cd<=0&&!G.inTown){const t=nearest(p.x,p.y,320);if(t){h.dive=t;playSfx('screech');}}}
  const dx=gx-h.x,dy=gy-h.y,d=Math.hypot(dx,dy);if(d>620){h.x=p.x;h.y=p.y-30;return;}
  const st=Math.min(d,(h.dive?HAWK_SPD:HAWK_SPD*0.6)*dt);if(d>0.5){h.x+=dx/d*st;h.y+=dy/d*st;h.face=Math.atan2(dy,dx);}} // flies over walls
// Marked enemies take more damage (game.js hitEnemy)
const markMul=e=>e.markUntil>G.time?1+(e.markAmt||0):1;
// The hawk from above: wings that beat, a pale body, a hooked yellow beak.
function drawHawk(h){const x=ctx,f=Math.sin(h.walk*18)*0.5;x.save();x.fillStyle='rgba(0,0,0,.2)';x.beginPath();x.ellipse(h.x,h.y+26,8,3,0,0,TAU);x.fill();
  x.translate(h.x,h.y);x.rotate(h.face);x.fillStyle='#6a5640';for(const sd of [-1,1]){x.beginPath();x.moveTo(2,0);x.quadraticCurveTo(-2,sd*(14+f*6),-8,sd*(16+f*8));x.lineTo(-4,sd*3);x.fill();}
  x.fillStyle='#c8b494';x.beginPath();x.ellipse(0,0,8,3.5,0,0,TAU);x.fill();x.fillStyle='#8a7050';x.beginPath();x.moveTo(-7,0);x.lineTo(-13,-3);x.lineTo(-13,3);x.fill();
  x.fillStyle='#ffd36b';x.beginPath();x.moveTo(8,-1.5);x.lineTo(11.5,0);x.lineTo(8,1.5);x.fill();x.restore();}
// Marked enemies: a small gold target above them (render.js, with ailment pips)
function drawMarks(onScreen){for(const e of G.enemies){if(e.dead||e.hidden||!(e.markUntil>G.time)||!onScreen(e.x,e.y,40))continue;const y=e.y-e.r-16;upr(e.x,e.y);
  ctx.strokeStyle='#ffd36b';ctx.lineWidth=1.5;ctx.globalAlpha=0.8;ctx.beginPath();ctx.arc(e.x,y,5,0,TAU);ctx.moveTo(e.x-8,y);ctx.lineTo(e.x+8,y);ctx.moveTo(e.x,y-8);ctx.lineTo(e.x,y+8);ctx.stroke();ctx.globalAlpha=1;ctx.restore();}}
// Caltrops and stuck Explosive Arrows on the floor (with the traps)
function drawCaltrops(onScreen){for(const z of G.skz||[]){if(!onScreen(z.x,z.y,90))continue;
  if(z.k==='caltrop'){ctx.fillStyle='#8a8478';for(let k=0;k<10;k++){const a=k*2.4,d=(k*37%100)/100*(z.R||CALTROP_R)*0.85;ctx.fillRect(z.x+Math.cos(a)*d-1.5,z.y+Math.sin(a)*d-1.5,3,3);}
    ctx.globalAlpha=0.15;ctx.strokeStyle='#c8c0b0';ctx.beginPath();ctx.arc(z.x,z.y,z.R||CALTROP_R,0,TAU);ctx.stroke();ctx.globalAlpha=1;}
  else if(z.k==='bomb'){const k=1-z.t/(z.T||BOMB_T);ctx.fillStyle='#3a2a1a';ctx.fillRect(z.x-1,z.y-10,2,10);ctx.fillStyle=k>0.6&&Math.sin(G.time*30)>0?'#fff0a0':'#ff8a2a';ctx.beginPath();ctx.arc(z.x,z.y-10,3+k*2,0,TAU);ctx.fill();}}}
// Vault landed (game.js): Parting Shot
function vaultLand(p,L){if(!L.shot)return;const t=nearest(p.x,p.y,500);if(t)p.face=Math.atan2(t.y-p.y,t.x-p.x);const a0=p.face,sk=G.sk;G.sk=L.sk??null;
  for(let k=-2;k<=2;k++){const b=a0+k*0.13;shoot({x:p.x+Math.cos(b)*100,y:p.y+Math.sin(b)*100},740,4,'#e8dcc4',{mult:L.shot,weapon:true,arrow:true});}p.face=a0;G.sk=sk;playSfx('twang');}
