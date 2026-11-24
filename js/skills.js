'use strict';
// Class skills, casting and attack animation timing.
// ---------- skills ----------
function nearest(x,y,maxD,exclude){let best=null,bd=maxD;for(const e of G.enemies){if(e.dead||e.hidden||(exclude&&exclude.has(e)))continue;const d=Math.hypot(e.x-x,e.y-y)-e.r;if(d<bd){bd=d;best=e;}}return best;}
function aimPoint(range){const p=G.p;const e=nearest(p.x,p.y,range);if(e){p.face=Math.atan2(e.y-p.y,e.x-p.x);return {x:e.x,y:e.y,e};}return {x:p.x+Math.cos(p.face)*range*0.6,y:p.y+Math.sin(p.face)*range*0.6,e:null};}
function aoe(x,y,r,mult,opts){let n=0;for(const e of G.enemies){if(e.dead||e.hidden)continue;if(Math.hypot(e.x-x,e.y-y)<r+e.r){hitEnemy(e,mult,opts);n++;}}return n;}
function gainRes(v){G.p.res=Math.min(G.stats.res,G.p.res+v);}

// Arcane Bolt look per weapon type: [speed, radius, colour].
const BOLT={none:[600,6.5,'#c48bff'],wand:[600,5,'#c48bff'],scepter:[600,6.5,'#ff9a4a'],staff:[500,8.5,'#c48bff'],rod:[680,6,'#7fe0ff'],
  thornstaff:[500,8.5,'#8ae05a'],runewand:[600,5,'#7ff0ff'],demonstaff:[500,9,'#ff4a3a'],spellblade:[640,6,'#d8a0ff']};
const SKILLS={
  warden:[
    {name:'Cleave',icon:'🪓',cd:0.59,cost:0, // v1.0.100: 15% slower (was 0.5)
      desc:r=>`Swing in a wide arc for ${pct(1+0.12*(r-1))} weapon damage. Each hit generates 7 Fury.`,
      cast(r){const p=G.p,s=G.stats;const t=nearest(p.x,p.y,170);if(t)p.face=Math.atan2(t.y-p.y,t.x-p.x);
        let hand='mh';if(s.oh){p.hand=p.hand==='mh'?'oh':'mh';hand=p.hand;}
        const h=hand==='oh'?s.oh:s.mh,w0=h?WEAPONS[h.wt]||FIST:FIST,big=w0.hands===2,wide=hasMod('widearc'); // skillmods.js: Wide Arc
        const w=wide?{...w0,reach:w0.reach*1.2,arc:Math.min(Math.PI,w0.arc*1.5)}:w0,m=(1+0.12*(r-1))*(wide?0.85:1);
        let n=0;for(const e of G.enemies){if(e.dead)continue;const d=dist(e,p);if(d<w.reach+e.r&&angDiff(Math.atan2(e.y-p.y,e.x-p.x),p.face)<w.arc){hitEnemy(e,m,{kb:big?95:60,hand,weapon:true});n++;}}
        if(n&&hasMod('momentum')){p.momN=Math.min(5,(p.momT>0?p.momN||0:0)+1);p.momT=3;}
        gainRes(Math.min(n,3)*7*(p.buffT>0&&hasMod('battlefury')?2:1));if(big&&n)G.shake=Math.max(G.shake,4);if(hasPw('shockwave')&&n)shockwave(p.face,1+0.12*(r-1));if(hasPw('cinderCleave'))cinderPatch(p.face,w.reach); // Tremorblade's shockwave only when Cleave hits something
        G.fx.push({type:'arc',x:p.x,y:p.y,a:p.face,r:w.reach-8,half:w.arc,lw:w.anim==='thrust'?7:big?16:w.anim==='stab'?5:10,dir:hand==='oh'?1:-1,t:0,max:big?0.3:w.anim==='stab'?0.12:0.18,col:big?'#ffd090':'#ffe0b0'});
        startAtk(w.anim,hand,0);}},
    {name:'Leap Slam',icon:'💥',cd:5,cost:25,
      desc:r=>`Leap at an enemy and smash the ground for ${pct(1.8+0.22*(r-1))} damage, stunning for 1s. Costs 25 Fury.`,
      cast(r){const p=G.p,far=hasMod('longleap')?1.5:1,a=aimPoint(270*far);let tx=a.x,ty=a.y;const dx=tx-p.x,dy=ty-p.y,L=Math.hypot(dx,dy),M=260*far;if(L>M){tx=p.x+dx/L*M;ty=p.y+dy/L*M;}
        for(let k=0;k<20&&blockedAt(tx,ty,p.r);k++){tx-=(tx-p.x)*0.15;ty-=(ty-p.y)*0.15;}
        p.leap={sx:p.x,sy:p.y,tx,ty,t:0,dur:far>1?0.46:0.38,mult:1.8+0.22*(r-1),sk:G.sk};}},
    {name:'Whirlwind',icon:'🌀',cd:7,cost:35,
      desc:r=>`Spin for ${(2+0.1*(r-1)).toFixed(1)}s, hitting everything nearby for ${pct(0.5+0.07*(r-1))} damage 4 times per second. Move faster while spinning.`,
      cast(r){const p=G.p;p.spin=(2+0.1*(r-1))*(hasPw('oathspin')?2:1);p.spinTick=0;p.spinSk=G.sk;p.spinMult=0.5+0.07*(r-1);}},
    {name:'War Cry',icon:'📯',cd:16,cost:0,
      desc:r=>`Roar: heal 20% Life, gain 30 Fury and +${pct(0.3+0.04*(r-1))} damage for 6s.`,
      cast(r){const p=G.p;p.buffT=6;p.buffAmt=0.3+0.04*(r-1);healPlayer(G.stats.life*(hasMod('rally')?0.4:0.2));gainRes(30);if(hasMod('rally'))p.rallyT=6;if(hasMod('terrify'))terrify(p);if(hasPw('warcryShield')){p.barrier=G.stats.life*0.25;p.barrierT=6;}G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:160,t:0,max:0.5,col:'#ffcc55'});
        for(const e of G.enemies)if(!e.dead&&dist(e,p)<200)e.stun=Math.max(e.stun,0.6);}},
    {name:'Earthshatter',icon:'🌋',cd:12,cost:50,
      desc:r=>`Split the earth around you for ${pct(3.2+0.4*(r-1))} damage and stun for 1.5s. Costs 50 Fury.`,
      cast(r){const p=G.p,m=3.2+0.4*(r-1);if(hasMod('fissure')){fissure(m);return;}G.fx.push({type:'tele',x:p.x,y:p.y,r:165,t:0,max:0.35,col:'#ff7a2a',own:1});
        G.delayed.push({sk:G.sk,t:0.35,fn:()=>{aoe(p.x,p.y,165,m,{stun:1.5});G.shake=14;G.hitStop=0.07;fxCracks(p.x,p.y,175);G.fx.push({type:'ring',x:p.x,y:p.y,r0:20,r1:175,t:0,max:0.4,col:'#ff7a2a'});burst(p.x,p.y,40,'#c8763a',260);
          shatterMods(p.x,p.y,165,m,r);}});}}
  ],
  arcanist:[
    {name:'Arcane Bolt',icon:'✴️',cd:0.45,cost:0, // v1.0.100: 15% slower (was 0.38)
      desc:r=>`Fire a bolt for ${pct(0.95+0.12*(r-1))} weapon damage. Each hit restores 2 Mana.`,
      cast(r){const a=aimPoint(560),wt=G.stats.mh&&G.stats.mh.wt,B=BOLT[wt]||BOLT.none,oc=boltCharge(),sip=hasMod('siphon'); // skillmods.js: Overcharge, Siphon, Pierce
        shoot(a,B[0],B[1]*(oc?1.6:1),oc?'#ffe27a':B[2],{mult:(0.95+0.12*(r-1))*(oc?3:1),onhit:()=>{gainRes(2);if(sip)healPlayer(G.stats.life*0.01,true);},weapon:true,pierce:G.stats.pierce+(hasMod('pierce')?2:0),explode:hasPw('blast')?55:0,home:hasPw('homing')});
        if(hasPw('arcaneFan')){const p=G.p,base=Math.atan2(a.y-p.y,a.x-p.x);for(const o of [-0.28,0.28])shoot({x:p.x+Math.cos(base+o)*300,y:p.y+Math.sin(base+o)*300},B[0],B[1]*0.8,B[2],{mult:(0.95+0.12*(r-1))*0.6,weapon:true});p.face=base;}}},
    {name:'Fireball',icon:'🔥',cd:0.9,cost:12,
      desc:r=>`Hurl a fireball that explodes for ${pct(1.7+0.22*(r-1))} damage in an area. Costs 12 Mana.`,
      cast(r){const a=aimPoint(600),F=fireballMod(); // skillmods.js: Big Bang, Rapid Fire (speed, size, blast, damage)
        if(hasPw('split')){const p=G.p,base=Math.atan2(a.y-p.y,a.x-p.x),L=Math.max(80,Math.hypot(a.x-p.x,a.y-p.y));for(const o of [-0.3,0,0.3])shoot({x:p.x+Math.cos(base+o)*L,y:p.y+Math.sin(base+o)*L},430*F.spd,9*F.size,'#ff8a2a',{mult:(1.7+0.22*(r-1))*0.75*F.mult,explode:70*F.blast});G.p.face=base;}
        else shoot(a,430*F.spd,10*F.size,'#ff8a2a',{mult:(1.7+0.22*(r-1))*F.mult,explode:78*F.blast});}},
    {name:'Frost Nova',icon:'❄️',cd:6,cost:20,
      desc:r=>`Blast of frost around you: ${pct(0.8+0.1*(r-1))} damage and freezes enemies for ${(1.8+0.1*r).toFixed(1)}s. Costs 20 Mana.`,
      cast(r){const p=G.p;aoe(p.x,p.y,150,0.8+0.1*(r-1),hasMod('coldsnap')?{chill:3}:{freeze:(1.8+0.1*r)*(hasMod('deepfreeze')?2:1)});if(hasMod('icearmour')){p.iceArmT=4;G.fx.push({type:'ring',x:p.x,y:p.y,r0:p.r,r1:p.r+16,t:0,max:0.4,col:'#bfe8ff'});}if(hasPw('novaSpikes')){const f=p.face;for(let k=0;k<8;k++){const a=k*TAU/8;shoot({x:p.x+Math.cos(a)*300,y:p.y+Math.sin(a)*300},460,6,'#bfe8ff',{mult:0.5+0.05*(r-1)});}p.face=f;}G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:155,t:0,max:0.4,col:'#9fe4ff'});burst(p.x,p.y,30,'#bff0ff',240);}},
    {name:'Chain Lightning',icon:'⚡',cd:2,cost:18,
      desc:r=>`Lightning jumps between ${Math.min(8,3+Math.floor((r-1)/2))} enemies for ${pct(1.25+0.15*(r-1))} damage each. Costs 18 Mana.`,
      cast(r){const p=G.p;let cur=nearest(p.x,p.y,340);if(!cur){G.p.res+=18;G.p.cd[3]=0.2;return;}
        const hit=new Set(),pts=[{x:p.x,y:p.y}];const endless=hasPw('endless')&&p.res>G.stats.res*0.5,n=endless?30:Math.min(8,3+Math.floor((r-1)/2))+(hasPw('stormweave')?4:0)+(hasPerk('stormReach')?2:0); // subclasses.js: Storm Reach
        const fork=hasMod('fork'),over=hasMod('overload'),m0=(1.25+0.15*(r-1))*(fork?0.75:1); // skillmods.js: Fork, Overload (Static: ailments.js)
        const chainFrom=(cur,pts)=>{for(let k=0;k<n&&cur;k++){hit.add(cur);pts.push({x:cur.x,y:cur.y});hitEnemy(cur,m0*(over?Math.pow(1.15,k):1),{});cur=nearest(cur.x,cur.y,210,endless?new Set([cur]):hit);}}; // endless: may bounce back, just not onto the same enemy twice in a row
        const second=fork?nearest(p.x,p.y,340,new Set([cur])):null;chainFrom(cur,pts);
        if(second&&!second.dead){const pts2=[{x:p.x,y:p.y}];if(!hit.has(second))chainFrom(second,pts2);if(pts2.length>1)G.fx.push({type:'bolt',pts:pts2,t:0,max:0.22});}
        if(hasPw('chainBlast')&&pts.length>1){const L=pts[pts.length-1];aoe(L.x,L.y,90,(1.25+0.15*(r-1))*1.5,{});fxExplosion(L.x,L.y,90,'#9fd8ff');}
        G.fx.push({type:'bolt',pts,t:0,max:0.22});}},
    {name:'Meteor',icon:'☄️',cd:10,cost:40,
      desc:r=>`Call down a meteor for ${pct(3.8+0.45*(r-1))} damage. Leaves burning ground for 3s. Costs 40 Mana.`,
      cast(r){const a=aimPoint(440);const x=a.x,y=a.y,ice=hasMod('comet'),molten=hasMod('moltencore'),fast=hasMod('swiftfall'),T=fast?0.15:0.8; // skillmods.js: Comet, Molten Core, Swift Fall
        G.fx.push({type:'tele',x,y,r:120,t:0,max:T,col:ice?'#9fe4ff':'#ff5a1a',own:1,meteor:1});
        G.delayed.push({sk:G.sk,t:T,fn:()=>{aoe(x,y,120,(3.8+0.45*(r-1))*(fast?0.8:1),ice?{freeze:1.5}:{});G.shake=12;G.hitStop=0.06;fxExplosion(x,y,120,ice?'#9fe4ff':undefined);burst(x,y,50,ice?'#bff0ff':'#ff8a2a',300);G.fx.push({type:'ring',x,y,r0:20,r1:130,t:0,max:0.35,col:ice?'#bfe8ff':'#ffb04a'});
          if(!ice)G.hazards.push({sk:G.sk,x,y,r:molten?165:110,t:molten?6:3,tick:0,mult:0.3+0.04*(r-1)});}});
        if(hasPw('meteorShower'))for(let k=0;k<3;k++){const a=rand(0,TAU),mx=x+Math.cos(a)*95,my=y+Math.sin(a)*95;G.delayed.push({sk:G.sk,t:1+k*0.15,fn:()=>{aoe(mx,my,70,(3.8+0.45*(r-1))*0.4,{});fxExplosion(mx,my,70);}});}}}
  ]
};
function rk(i){const c=G.char;return c.skills[i]>0?c.skills[i]+G.stats.skill[i]:0;}
function skillCd(i){const sk=SKILLS[G.char.cls][i],w=G.char.cls==='warden';
  if(w&&i===1&&hasPw('bloodleap'))return 0.35;if(w&&i===4&&hasPw('faultline'))return sk.cd*0.5*(1-G.stats.cdr/100);
  const p=G.p,mod=w&&i===0&&p?(1+(p.momT>0?0.06*(p.momN||0):0))*(p.buffT>0&&hasMod('battlefury')?1.25:1)*rushMul():1; // skillmods.js: Momentum, Battle Fury; subclasses.js: Kill Rush
  if(!w&&i===2)return sk.cd*(hasMod('coldsnap')?0.5:1)*(hasPerk('stormReach')?0.75:1)*(1-G.stats.cdr/100); // skillmods.js: Cold Snap; subclasses.js: Storm Reach
  if(w&&i===1&&hasMod('longleap'))return Math.max(0.5,(sk.cd-1.5)*(1-G.stats.cdr/100));
  if(!w&&i===1)return sk.cd*(1-G.stats.cdr/100)/(1+(G.stats.cspd||0)/100); // v1.0.101: Cast Speed also speeds up Fireball
  return i===0?sk.cd/(G.stats.wspd*(1+(w?G.stats.aspd:(G.stats.cspd||0))/100)*mod):sk.cd*(1-G.stats.cdr/100);} // Warden: Attack Speed, Arcanist: Cast Speed
// Attack animation: style from the weapon archetype (swing, stab, heavy, flick, thrust); duration fits inside the attack interval.
const ATK_DUR={swing:0.24,stab:0.14,heavy:0.46,flick:0.2,thrust:0.28};
function startAtk(style,hand,i){const p=G.p,s=G.stats;if(!style){const w=wOf(G.char.equip.mainhand)||FIST;style=w.anim;}
  const dur=Math.min(ATK_DUR[style]||0.24,i===0?skillCd(0)*0.95:0.5);p.atk={style,hand:hand||'mh',t:0,dur};
  if(i===0&&G.char.cls==='warden')skillSfx('warden',0,style);} // sfx.js: the weapon's whoosh
function tryCast(i){
  const p=G.p;if(G.paused||!p||p.dead||playerFrozen())return; // ailments.js: no casting while frozen
  // v1.0.98: other skills can be used during Leap Slam (in the air) and Whirlwind; only Leap Slam waits for its own landing
  const r=rk(i);if(r<=0||p.cd[i]>0||p.leap&&i===1)return;
  const sk=SKILLS[G.char.cls][i];
  const lc=lifeCost(i); // Bloodleap Greaves: pay Life instead of Fury
  const cost=modCost(i,sk.cost); // skillmods.js: Rapid Fire
  if(lc?p.hp<=lc+1:p.res<cost)return;
  if(lc){p.hp-=lc;floatText(p.x,p.y-p.r-8,'-'+lc,'#e04060',false);}else p.res-=cost;
  p.cd[i]=skillCd(i);p.cdMax[i]=p.cd[i];
  if(i>0&&hasPw('ouroboros')&&Math.random()<0.3){p.cd[i]=0;floatText(p.x,p.y-p.r-24,'Free!','#ff9a3a',false);
    if(combo('Eye of the Storm'))for(let j=1;j<5;j++)if(j!==i&&p.cd[j]>0)p.cd[j]=Math.max(0,p.cd[j]-1);}
  G.sk=i;try{sk.cast(r);}finally{G.sk=null;}skillSfx(G.char.cls,i); // sfx.js; G.sk: hits from this cast count as this skill (+% skill damage)
  if(G.char.cls==='arcanist')startAtk(null,'mh',i);else if(i===1||i===4)startAtk(is2h(G.char.equip.mainhand)?'heavy':'swing','mh',i);
}
