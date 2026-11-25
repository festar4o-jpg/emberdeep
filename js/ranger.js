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
