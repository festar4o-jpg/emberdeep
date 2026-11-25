'use strict';
// Skill modifiers: each skill has 3, unlocked by the skill's own rank (MOD_UNLOCK, points spent, not +skill from items).
// One can be active per skill, swapped any time for free on the skill screen. Saved per character as c.mods
// (one key or null per skill). They stack with legendary powers (uniques.js UPOW) and never copy one.
// A modifier with live:false is listed but does nothing yet (shown as "coming soon").
const MOD_UNLOCK=[3,6,10];
const SKILL_MODS={
  warden:[
    [{k:'execute',name:'Executioner',t:'+50% damage to enemies below 30% Life'},
     {k:'momentum',name:'Momentum',t:'Each Cleave that hits gives +6% attack speed for 3s, stacking up to 5 times'},
     {k:'widearc',name:'Wide Arc',t:'Cleave swings 50% wider and reaches 20% further, but deals 15% less damage'}],
    [{k:'aftershock',name:'Aftershock',t:'A second, weaker slam (60% damage) hits where you landed 1s later'},
     {k:'ironland',name:'Iron Landing',t:'Take 40% less damage for 2s after landing'},
     {k:'longleap',name:'Long Leap',t:'Leap 50% further, and the cooldown is 1.5s shorter'}],
    [{k:'bloodspin',name:'Bloodspin',t:'Each enemy Whirlwind hits heals you for 0.5% of your Life'},
     {k:'bladeward',name:'Blade Ward',t:'+25% block chance while spinning'},
     {k:'dustdevil',name:'Dust Devils',t:'While spinning, throw a small whirlwind at a nearby enemy every 0.5s'}],
    [{k:'rally',name:'Rally',t:'War Cry heals 40% of your Life instead of 20%, then 2% per second while its boost lasts'},
     {k:'terrify',name:'Terrify',t:'Enemies near you flee for 2s (bosses only stagger)'},
     {k:'battlefury',name:'Battle Fury',t:'While War Cry\'s boost lasts, Cleave is 25% faster and builds double Fury'}],
    [{k:'fissure',name:'Fissure',t:'Earthshatter tears a long line forward instead of a circle, 25% more damage'},
     {k:'tremors',name:'Tremors',t:'Three smaller quakes follow around you (40% damage each)'},
     {k:'magma',name:'Magma',t:'Earthshatter leaves burning ground for 4s'}]
  ],
  arcanist:[
    [{k:'pierce',name:'Pierce',t:'Arcane Bolt passes through 2 enemies'},
     {k:'overcharge',name:'Overcharge',t:'Every 4th Arcane Bolt deals triple damage'},
     {k:'siphon',name:'Siphon',t:'Each Arcane Bolt hit heals you for 1% of your Life'}],
    [{k:'ignite',name:'Ignite',t:'Fireball always sets enemies burning (normally a 20% chance): 25% of its damage per second for 3s'},
     {k:'bigbang',name:'Big Bang',t:'Fireball is bigger and slower, with a 60% wider blast and 25% more damage'},
     {k:'rapid',name:'Rapid Fire',t:'Fireball flies 40% faster and costs half as much Mana, but deals 20% less damage'}],
    [{k:'deepfreeze',name:'Deep Freeze',t:'Frost Nova freezes for twice as long'},
     {k:'coldsnap',name:'Cold Snap',t:'Frost Nova\'s cooldown is halved, but instead of freezing it slows enemies to half speed for 3s'},
     {k:'icearmour',name:'Ice Armour',t:'After casting Frost Nova, take 30% less damage for 4s'}],
    [{k:'fork',name:'Fork',t:'Chain Lightning starts as two bolts aimed at different enemies (75% damage each, never the same enemy twice)'},
     {k:'overload',name:'Overload',t:'Each bounce deals 15% more damage than the last'},
     {k:'static',name:'Static',t:'Chain Lightning always Shocks, 2 stacks a hit (normally a 35% chance of 1): each stack is +10% damage taken, up to 3'}],
    [{k:'comet',name:'Comet',t:'Meteor turns to ice: it freezes enemies for 1.5s, but leaves no burning ground'},
     {k:'moltencore',name:'Molten Core',t:'Meteor\'s burning ground lasts twice as long (6s) and covers 50% more'},
     {k:'swiftfall',name:'Swift Fall',t:'Meteor lands almost instantly, but deals 20% less damage'}]
  ],
  ranger:[ // v1.0.128
    [{k:'asSplit',name:'Split Arrow',t:'Arrow Shot looses 2 more arrows beside the first, 50% damage each'},
     {k:'asBarbed',name:'Barbed Arrows',t:'Arrow Shot always makes enemies Bleed'},
     {k:'asSteady',name:'Steady Aim',t:'Arrow Shot pierces 2 more enemies and restores 6 Focus a hit instead of 3'}],
    [{k:'msVolley',name:'Volley',t:'Multishot looses 9 arrows in a wider fan, 20% less damage each'},
     {k:'msFocus',name:'Focused Fire',t:'Multishot looses 3 arrows close together, 60% more damage each: good against one big enemy'},
     {k:'msReturn',name:"Hunter's Return",t:'Each Multishot arrow that hits restores 4 Focus instead of 1'}],
    [{k:'trCluster',name:'Cluster Traps',t:'Spike Trap throws 3 traps at once, 50% damage each; up to 6 traps'},
     {k:'trBarb',name:'Lacerating Trap',t:'Spike Trap deals 20% more damage and makes everything it hits Bleed'},
     {k:'trHair',name:'Hair Trigger',t:'Spike Trap arms at once, springs from 50% further, and its cooldown is 1.5s shorter'}],
    [{k:'wfPack',name:'Pack',t:'Call two wolves, each with 60% of the Life and 70% of the damage'},
     {k:'wfAlpha',name:'Alpha',t:'Your wolf is bigger: twice the Life and 40% more damage'},
     {k:'wfBond',name:'Bond',t:'While a wolf lives you take 10% less damage, and each of its bites heals you for 0.5% of your Life'}],
    [{k:'rnStorm',name:'Arrow Storm',t:'Rain of Arrows lasts twice as long (12 volleys), but costs 60 Focus'},
     {k:'rnPin',name:'Pinning Rain',t:'Enemies under Rain of Arrows are slowed by 40%'},
     {k:'rnDown',name:'Downpour',t:'Rain of Arrows falls on a smaller area (70%) with 60% more damage'}]
  ]
};
// mod keys this class has, for save cleanup
function modKeys(cls,i){return (SKILL_MODS[cls]&&SKILL_MODS[cls][i]||[]).map(m=>m.k);}
function modUnlocked(c,i,j){return (c.skills[i]||0)>=MOD_UNLOCK[j];}
// keeps c.mods valid: 5 entries, each a key of that skill's own modifiers (still unlocked) or null.
// v1.0.114: second skills (skillalts.js) keep theirs in c.amods, the same way (ALT_MODS).
const altKeys=(cls,i)=>(ALT_MODS[cls]&&ALT_MODS[cls][i]||[]).map(m=>m.k);
function fixMods(c){const m=Array.isArray(c.mods)?c.mods:[],am=Array.isArray(c.amods)?c.amods:[],ok=(ks,v,i)=>{const j=ks.indexOf(v);return j>=0&&modUnlocked(c,i,j)?v:null;};
  c.mods=[0,1,2,3,4].map(i=>ok(modKeys(c.cls,i),m[i],i));c.amods=[0,1,2,3,4].map(i=>ok(altKeys(c.cls,i),am[i],i));return c.mods;}
// The modifiers of the skill on button i now, and where its pick is kept.
const modsAt=(c,i)=>altOn(c,i)?ALT_MODS[c.cls][i]:SKILL_MODS[c.cls][i];
const pickOf=(c,i)=>(altOn(c,i)?c.amods:c.mods)||[];
// the active modifier of skill i (key or null)
function skMod(i){const c=G.char;return c?pickOf(c,i)[i]||null:null;}
// is modifier k active on any skill of the current hero (first skills from c.mods, second skills from c.amods)
function hasMod(k){const c=G.char;if(!c)return false;for(let i=0;i<5;i++)if(pickOf(c,i)[i]===k)return true;return false;}
// pick (or, if it is already active, clear) modifier j of skill i
function pickMod(i,j){const c=G.char;fixMods(c);const M=modsAt(c,i)[j],P=altOn(c,i)?c.amods:c.mods;
  if(!modUnlocked(c,i,j)){toast(M.name,`${M.t}. Unlocks at ${skillAt(c,i).name} rank ${MOD_UNLOCK[j]}`);return false;}
  P[i]=P[i]===M.k?null:M.k;playSfx('click');saveChar();return true;}
// the modifier row for the skill screen
function modRowHtml(c,i){if(!(c.skills[i]>0))return '';const ms=modsAt(c,i),act=pickOf(c,i)[i];if(!ms||!ms.length)return '';
  const chips=ms.map((m,j)=>{const open=modUnlocked(c,i,j);
    return `<span class="mod${m.k===act?' on':''}${open?'':' lk'}" data-m="${i}:${j}">${open?'':'🔒 '}${m.name}${open?'':` <small>R${MOD_UNLOCK[j]}</small>`}</span>`;}).join('');
  const A=ms.find(m=>m.k===act);
  return `<div class="mods">${chips}</div><div class="modt">${A?`<b>${A.name}:</b> ${A.t}${A.live===false?' <i>(coming soon)</i>':''}`:ms.some((m,j)=>modUnlocked(c,i,j))?'Tap a modifier to use it':`First modifier at rank ${MOD_UNLOCK[0]}`}</div>`;}

// ---------- effects ----------
// Hooks: skills.js (Cleave, Leap range, War Cry, Earthshatter, skillCd), game.js (Executioner in hitEnemy,
// modTakenMul/Blade Ward in dmgPlayer, modTick, leapMods on landing, Bloodspin + spinMods while spinning, fleeStep).
function modTakenMul(){const p=G.p;return (p.ironT>0?0.6:1)*(p.iceArmT>0?0.7:1)*(p.chargeGuardT>0?0.6:1)*(p.bannerOn&&hasMod('banFury')?0.8:1)*(hasMod('wfBond')&&G.pets&&G.pets.some(w=>w.hp>0)?0.9:1);} // ranger.js: Bond // Iron Landing, Ice Armour; skillalts.js: Bull's Hide, Rally Point
function modTick(p,dt){
  if(p.momT>0){p.momT-=dt;if(p.momT<=0)p.momN=0;}  // Momentum stacks run out
  if(p.ironT>0)p.ironT-=dt;if(p.iceArmT>0)p.iceArmT-=dt;
  if(p.rallyT>0){p.rallyT-=dt;if(!p.dead)healPlayer(G.stats.life*0.02*dt,true);} // Rally
}
// Leap Slam just landed
function leapMods(p,L){const x=p.x,y=p.y;
  if(hasMod('aftershock')){G.fx.push({type:'tele',x,y,r:95,t:0,max:1,col:'#ffcc88',own:1});
    G.delayed.push({sk:1,t:1,fn:()=>{aoe(x,y,95,L.mult*0.6,{stun:0.5});G.shake=Math.max(G.shake,7);fxCracks(x,y,90);burst(x,y,18,'#c8a070',200);
      G.fx.push({type:'ring',x,y,r0:10,r1:100,t:0,max:0.3,col:'#ffcc88'});playSfx('slam');}});}
  if(hasMod('ironland')){p.ironT=2;floatText(p.x,p.y-p.r-24,'Iron Skin','#cfd6dc',false);G.fx.push({type:'ring',x,y,r0:p.r,r1:p.r+16,t:0,max:0.4,col:'#cfd6dc'});}
}
// Whirlwind, every frame while spinning: Dust Devils
function spinMods(p,dt){if(!hasMod('dustdevil'))return;p.ddT=(p.ddT||0)-dt;if(p.ddT>0)return;p.ddT=0.5;
  const t=nearest(p.x,p.y,320);if(!t)return;const a=Math.atan2(t.y-p.y,t.x-p.x);
  G.proj.push({sk:2,x:p.x+Math.cos(a)*20,y:p.y+Math.sin(a)*20,vx:Math.cos(a)*380,vy:Math.sin(a)*380,r:11,col:'#d8c8a0',life:0.8,from:'p',mult:p.spinMult*0.8,pierce:99,wave:true});}
// War Cry: Terrify. Ordinary monsters run from you (after War Cry's own short stun); bosses only get that stun.
function terrify(p){for(const e of G.enemies){if(e.dead||e.hidden||e.type==='boss'||e.zb||dist(e,p)>260)continue;e.fearT=2.6;floatText(e.x,e.y-e.r-14,'Fear','#c080ff',false);}}
function fleeStep(e,dt){const p=G.p;e.fearT-=dt;e.wind=0;e.tele=null;e.act=null;e.lockA=null;e.dash=0;
  const a=Math.atan2(e.y-p.y,e.x-p.x);e.face=a;moveEnt(e,Math.cos(a)*e.spd*0.9*dt,Math.sin(a)*e.spd*0.9*dt);}
// Earthshatter: Fissure. A line 340 long, 90 wide, aimed at the nearest enemy, 25% more damage.
const FISSURE_L=340,FISSURE_W=45;
function fissure(m){const p=G.p,t=aimPoint(FISSURE_L),a=p.face,x0=p.x,y0=p.y,ca=Math.cos(a),sa=Math.sin(a);
  for(let d=40;d<=FISSURE_L;d+=60)G.fx.push({type:'tele',x:x0+ca*d,y:y0+sa*d,r:FISSURE_W,t:0,max:0.35,col:'#ff7a2a',own:1});
  G.delayed.push({sk:4,t:0.35,fn:()=>{for(const e of G.enemies){if(e.dead||e.hidden)continue;const dx=e.x-x0,dy=e.y-y0,al=dx*ca+dy*sa,pp=Math.abs(-dx*sa+dy*ca);
      if(al>=-e.r&&al<=FISSURE_L+e.r&&pp<FISSURE_W+e.r)hitEnemy(e,m*1.25,{stun:1.5});}
    G.shake=14;G.hitStop=0.07;for(let d=50;d<=FISSURE_L;d+=70){fxCracks(x0+ca*d,y0+sa*d,60);burst(x0+ca*d,y0+sa*d,8,'#c8763a',200);}}});}
// Earthshatter landed (the circle): Tremors and Magma
function shatterMods(x,y,R,m,r){const p=G.p;
  if(hasMod('magma'))G.hazards.push({sk:4,x,y,r:R*0.9,t:4,tick:0,mult:0.3+0.03*(r-1)});
  if(hasMod('tremors'))for(let k=1;k<=3;k++)G.delayed.push({sk:4,t:0.4*k,fn:()=>{const a=rand(0,TAU),d=rand(50,120),qx=p.x+Math.cos(a)*d,qy=p.y+Math.sin(a)*d;
    G.fx.push({type:'tele',x:qx,y:qy,r:90,t:0,max:0.25,col:'#ff9a4a',own:1});
    G.delayed.push({sk:4,t:0.25,fn:()=>{aoe(qx,qy,90,m*0.4,{stun:0.5});G.shake=Math.max(G.shake,6);fxCracks(qx,qy,95);burst(qx,qy,14,'#c8763a',200);}});}});
}

// ---------- Arcanist ----------
// Arcane Bolt: Overcharge counts bolts; true on every 4th
function boltCharge(){if(!hasMod('overcharge'))return false;const p=G.p;p.ocN=((p.ocN||0)+1)%4;return p.ocN===0;}
// Fireball: Big Bang / Rapid Fire scale speed, size, blast and damage
function fireballMod(){return hasMod('bigbang')?{spd:0.7,size:1.4,blast:1.6,mult:1.25}:hasMod('rapid')?{spd:1.4,size:0.85,blast:1,mult:0.8}:{spd:1,size:1,blast:1,mult:1};}
// a skill's Mana/Fury cost after modifiers (Rapid Fire halves Fireball's)
function modCost(i,cost){const c=G.char;if(!c||altOn(c,i))return cost;if(c.cls==='arcanist'&&i===1&&hasMod('rapid'))return cost/2;if(c.cls==='ranger'&&i===4&&hasMod('rnStorm'))return 60;return cost;} // Rapid Fire, Arrow Storm
