'use strict';
// Unique items: each one is a named item of a fixed type with 1–2 powers that change how a skill or the character
// plays (the random affixes still roll on top). act = the first act / base tier it can drop in, so later acts add
// stronger uniques to the pool. cls = whose skills the powers use (null: anyone). Class uniques only drop for that class.
// Live numbers for a power's card: "m" times your average hit (weapon damage with your current gear, level and
// damage bonuses, before crits), e.g. "20% weapon damage (≈34) per second".
const pwHit=m=>{const s=G.stats;return s?Math.max(1,Math.round((s.dmin+s.dmax)/2*s.levelMul*(1+s.dmg/100)*(1+s.spell/100)*m)):0;};
const pwDet=(m,what)=>`${Math.round(m*100)}% weapon damage (≈${pwHit(m)})${what?' '+what:''}`;
// Fire powers hit every 0.5 s for this much of your weapon damage per hit.
const AURA_MULT=0.10,TRAIL_MULT=0.12,CINDER_MULT=0.14;
const UPOW={
  shockwave:{cls:'warden',t:'Cleave fires a shockwave forward that passes through enemies',d:()=>pwDet(0.6*(1+0.12*(pwRank(0)-1)),'to every enemy it passes')},
  pull:{cls:'warden',t:'Whirlwind pulls nearby enemies in'},
  bloodleap:{cls:'warden',t:'Leap Slam has no cooldown but costs 8% of your Life instead of Fury'},
  counter:{cls:'warden',t:'Blocking an attack releases a shockwave around you',d:()=>pwDet(0.9,'to enemies around you')},
  quake:{cls:'warden',t:'Leap Slam sets off Earthshatter where you land',d:()=>pwDet(3.2+0.4*(pwRank(4)-1),'in a wide area, stuns')},
  faultline:{cls:'warden',t:'Earthshatter cooldown is halved'},
  split:{cls:'arcanist',t:'Fireball splits into 3'},
  frostward:{cls:'arcanist',t:'Frost Nova casts itself when you are hit (every 4s at most)',d:()=>pwDet(0.8+0.1*(pwRank(2)-1),'to enemies around you, freezes')},
  endless:{cls:'arcanist',t:'Chain Lightning never stops bouncing while you have over 50% Mana'},
  skyfall:{cls:'arcanist',t:'A Meteor falls on a nearby enemy every 8s',d:()=>pwDet(3.8+0.45*(pwRank(4)-1),'on impact')+' · then '+pwDet(2*(0.3+0.04*(pwRank(4)-1)),'per second for 3s')},
  blast:{cls:'arcanist',t:'Arcane Bolt explodes on impact'},
  homing:{cls:'arcanist',t:'Arcane Bolts seek out enemies'},
  burnAura:{t:'Burning aura: enemies close to you take fire damage',d:()=>pwDet(2*AURA_MULT,'per second to each enemy close to you')},
  lastBreath:{t:'Dropping below 30% Life heals you for 30% and blasts enemies away (every 30s at most)',d:()=>pwDet(0.5,'to enemies around you')},
  fireTrail:{t:'You leave a trail of fire that burns enemies',d:()=>pwDet(2*TRAIL_MULT,'per second to enemies in the fire')},
  potionReset:{t:'Drinking a potion resets all your skill cooldowns'},
  ouroboros:{t:'Skills have a 30% chance not to go on cooldown'},
  // set bonus powers
  cinderCleave:{cls:'warden',t:'Cleave leaves burning ground',d:()=>pwDet(2*CINDER_MULT,'per second to enemies on it')},
  shatter:{cls:'arcanist',t:'Frozen enemies explode into ice shards when they die',d:()=>'8 shards, each '+pwDet(0.6,'')},
  stormweave:{cls:'arcanist',t:'Chain Lightning bounces 4 extra times'},
  oathspin:{cls:'warden',t:'Whirlwind lasts twice as long'},
  veilCrit:{t:'Critical hits heal you for 1% of your Life'},
  coreFlare:{t:'Every 5s a Core Flare erupts around you, burning nearby enemies',d:()=>pwDet(1.6,'around you')+' · then '+pwDet(0.4,'per second for 2s')}
};
const UNIQUES={
  tremorblade:{name:'Tremorblade',type:'weapon',wt:'sword',cls:'warden',act:1,pw:['shockwave']},
  maelstrom:{name:'Maelstrom Grips',type:'gloves',cls:'warden',act:2,pw:['pull']},
  bloodleap:{name:'Bloodleap Greaves',type:'boots',cls:'warden',act:3,pw:['bloodleap']},
  lastdoor:{name:'The Last Door',type:'shield',cls:'warden',act:4,pw:['counter']},
  worldbreaker:{name:'Worldbreaker',type:'weapon',wt:'maul',cls:'warden',act:5,pw:['quake','faultline']},
  scattering:{name:'Orb of Scattered Flame',type:'focus',kind:'orb',cls:'arcanist',act:1,pw:['split']},
  rimeheart:{name:'Rimeheart Vestment',type:'body',kind:'robe',cls:'arcanist',act:2,pw:['frostward']},
  stormcaller:{name:'Stormcaller',type:'weapon',wt:'rod',cls:'arcanist',act:3,pw:['endless']},
  fallingsky:{name:'Eye of the Falling Sky',type:'helm',cls:'arcanist',act:4,pw:['skyfall']},
  litany:{name:'Litany of Ash',type:'weapon',wt:'demonstaff',cls:'arcanist',act:5,pw:['blast','homing']},
  coalheart:{name:'Coal Heart',type:'ring',cls:null,act:1,pw:['burnAura']},
  deepheart:{name:'Heart of the Deep',type:'amulet',cls:null,act:2,pw:['lastBreath']},
  ashwalker:{name:'Ashwalker Treads',type:'boots',cls:null,act:3,pw:['fireTrail']},
  alchemist:{name:'Coil of the Alchemist',type:'belt',cls:null,act:4,pw:['potionReset']},
  ouroboros:{name:'Ouroboros Loop',type:'ring',cls:null,act:5,pw:['ouroboros']}
};
// ---------- set items (rarity 5, green) ----------
// A set has 2–6 pieces in any slots. Each piece is a named item with its own fixed stat list (values rolled, like a
// unique's affixes). Wearing n different pieces of a set turns on, in green:
//   SETS[k].bonus  partial set bonuses [[n, stats]], for 2 .. pieces-1 worn
//   SETS[k].full   the full set bonus, with every piece worn
//   SET_ITEMS[i].sb  a piece's own set lines [[n, stats]]: only while that piece and n pieces of its set are worn
// aura = 'r,g,b' colour of the full-set aura in the dungeon, matching the set's theme.
// act/cls work like uniques: the act is also the first base tier it comes in. Sets whose full bonus is a power
// (the stronger ones) start in act 3 or later. zone:5 = only drops while in act 5 (and from the act 5 boss).
// act/cls work like uniques. Stat keys are affix keys, or the set-only ones in SET_STAT; {pw:key} grants a power (UPOW).
const SET_STAT={gold:'+{v}% Gold Found',loot:'+{v}% Item Drop Chance'};
const SETS={
  wanderer:{aura:'255,206,72',name:"Wanderer's Fortune",cls:null,act:1,items:['wfband','wfsash'],bonus:[],full:[{k:'gold',v:20},{k:'loot',v:15}]},
  cinderguard:{aura:'255,140,40',name:'Cinderguard Vow',cls:'warden',act:3,items:['cgblade','cgseal','cgplate','cgtreads','cggrips'],
    bonus:[[2,[{k:'dmg',v:15},{k:'loh',v:4}]]],full:[{pw:'cinderCleave'}]},
  hollowking:{aura:'140,255,215',name:'Bulwark of the Hollow King',cls:'warden',act:3,items:['hkcrown','hkpendant','hkaegis'],
    bonus:[[2,[{k:'block',v:8},{k:'armor',v:40}]]],full:[{pw:'counter'}]},
  frostbound:{aura:'150,225,255',name:'Frostbound Regalia',cls:'arcanist',act:4,items:['fbstaff','fbcirclet','fbrobe','fbslippers'],
    bonus:[[2,[{k:'cdr',v:8},{k:'res',v:25}]]],full:[{pw:'shatter'}]},
  stormweaver:{aura:'110,150,255',name:"Stormweaver's Coil",cls:'arcanist',act:3,items:['swwand','sworb','swtorc'],
    bonus:[[2,[{k:'spell',v:20},{k:'crit',v:4}]]],full:[{pw:'stormweave'}]},
  marshwalker:{aura:'150,210,70',name:"Marshwalker's Garb",cls:null,act:2,items:['mwhood','mwwraps','mwwaders'],
    bonus:[[2,[{k:'move',v:8},{k:'life',v:25}]]],full:[{k:'aspd',v:10},{k:'regen',v:3}]},
  oathsworn:{aura:'235,235,255',name:'Oathsworn Bastion',cls:'warden',act:4,items:['osmaul','oshelm','osmail','osgirdle'],
    bonus:[[2,[{k:'armor',v:60}]],[3,[{k:'dmg',v:10},{k:'life',v:40}]]],full:[{pw:'oathspin'}]},
  unseenhour:{aura:'190,90,255',name:'Veil of the Unseen Hour',cls:null,act:4,items:['uhband','uhlocket','uhgloves','uhsash'],
    bonus:[[2,[{k:'crit',v:5}]],[3,[{k:'critd',v:25}]]],full:[{pw:'veilCrit'}]},
  embercore:{aura:'255,70,30',name:'Relics of the Ember Core',cls:null,act:5,zone:5,items:['ecdiadem','eccarapace','ecgrasp','ecstriders','ecgirdle','echeart'],
    bonus:[[2,[{k:'life',v:60},{k:'dmg',v:10}]],[4,[{k:'cdr',v:10},{k:'crit',v:6},{k:'res',v:30}]]],full:[{k:'dmg',v:20},{pw:'coreFlare'}]}
};
const SET_ITEMS={
  wfband:{name:"Wanderer's Lucky Band",set:'wanderer',type:'ring',affs:['life','crit','regen'],sb:[[2,[{k:'critd',v:15}]]]},
  wfsash:{name:"Wanderer's Coin Sash",set:'wanderer',type:'belt',affs:['life','armor','res'],sb:[[2,[{k:'move',v:8}]]]},
  cgblade:{name:'Cinderguard Oathblade',set:'cinderguard',type:'weapon',wt:'sword',affs:['dmg','critd','loh']},
  cgseal:{name:'Cinderguard Seal',set:'cinderguard',type:'ring',affs:['life','dmg','res']},
  cgplate:{name:'Cinderguard Plate',set:'cinderguard',type:'body',kind:'plate',affs:['life','armor','regen']},
  cgtreads:{name:'Cinderguard Treads',set:'cinderguard',type:'boots',affs:['move','life','armor']},
  cggrips:{name:'Cinderguard Gauntlets',set:'cinderguard',type:'gloves',affs:['aspd','crit','armor']},
  hkcrown:{name:'Crown of the Hollow King',set:'hollowking',type:'helm',affs:['life','armor','res']},
  hkpendant:{name:"Hollow King's Pendant",set:'hollowking',type:'amulet',affs:['life','block','regen']},
  hkaegis:{name:'Aegis of the Hollow King',set:'hollowking',type:'shield',affs:['armor','block','life']},
  fbstaff:{name:'Frostbound Staff',set:'frostbound',type:'weapon',wt:'staff',affs:['spell','crit','res']},
  fbcirclet:{name:'Frostbound Circlet',set:'frostbound',type:'helm',affs:['life','cdr','res']},
  fbrobe:{name:'Frostbound Robe',set:'frostbound',type:'body',kind:'robe',affs:['life','res','cdr']},
  fbslippers:{name:'Frostbound Slippers',set:'frostbound',type:'boots',affs:['move','life','regen']},
  swwand:{name:"Stormweaver's Wand",set:'stormweaver',type:'weapon',wt:'wand',affs:['spell','crit','aspd']},
  sworb:{name:"Stormweaver's Orb",set:'stormweaver',type:'focus',kind:'orb',affs:['spell','res','cdr']},
  swtorc:{name:"Stormweaver's Torc",set:'stormweaver',type:'amulet',affs:['spell','critd','life']},
  mwhood:{name:"Marshwalker's Hood",set:'marshwalker',type:'helm',affs:['life','regen','res']},
  mwwraps:{name:"Marshwalker's Wraps",set:'marshwalker',type:'gloves',affs:['aspd','life','loh']},
  mwwaders:{name:"Marshwalker's Waders",set:'marshwalker',type:'boots',affs:['move','life','regen']},
  osmaul:{name:'Oathsworn Maul',set:'oathsworn',type:'weapon',wt:'maul',affs:['dmg','critd','life']},
  oshelm:{name:'Oathsworn Greathelm',set:'oathsworn',type:'helm',affs:['life','armor','res']},
  osmail:{name:'Oathsworn Mail',set:'oathsworn',type:'body',kind:'chain',affs:['life','armor','regen']},
  osgirdle:{name:'Oathsworn Girdle',set:'oathsworn',type:'belt',affs:['life','armor','pot']},
  uhband:{name:'Band of the Unseen Hour',set:'unseenhour',type:'ring',affs:['crit','critd','life']},
  uhlocket:{name:'Locket of the Unseen Hour',set:'unseenhour',type:'amulet',affs:['crit','dmg','res']},
  uhgloves:{name:'Gloves of the Unseen Hour',set:'unseenhour',type:'gloves',affs:['crit','aspd','critd']},
  uhsash:{name:'Sash of the Unseen Hour',set:'unseenhour',type:'belt',affs:['life','res','regen']},
  ecdiadem:{name:'Ember Core Diadem',set:'embercore',type:'helm',affs:['life','crit','cdr']},
  eccarapace:{name:'Ember Core Carapace',set:'embercore',type:'body',affs:['life','armor','res']},
  ecgrasp:{name:'Ember Core Grasp',set:'embercore',type:'gloves',affs:['dmg','aspd','critd']},
  ecstriders:{name:'Ember Core Striders',set:'embercore',type:'boots',affs:['move','life','armor']},
  ecgirdle:{name:'Ember Core Girdle',set:'embercore',type:'belt',affs:['life','regen','pot']},
  echeart:{name:'Heart of the Ember Core',set:'embercore',type:'amulet',affs:['dmg','life','crit']}
};
// zone 5: in a dungeon depth of act 5 (any cycle), not in town (so no shop) and not anywhere else.
const inSetZone=S=>!S.zone||(!G.inTown&&G.depth>0&&actIdx(G.depth)+1===S.zone);
const setItemsFor=(type,cls,act)=>Object.keys(SET_ITEMS).filter(k=>{const I=SET_ITEMS[k],S=SETS[I.set];return I.type===type&&S.act<=act&&(!S.cls||S.cls===cls)&&inSetZone(S);});
// The act 5 boss: 40% chance of one extra Relics of the Ember Core piece.
function emberCoreDrop(e){if(Math.random()>=0.4)return;const si=pick(SETS.embercore.items);dropItem(e.x+rand(-40,40),e.y+rand(-40,40),genItem(G.depth+3,G.char.cls,0,null,0,null,5,si));}
const setOf=it=>it&&it.rarity===5&&SET_ITEMS[it.si]?SET_ITEMS[it.si].set:null;
// Different pieces of each set among these items (worn equipment): {setKey: count}.
function setCounts(items){const seen={},n={};for(const it of items){const s=setOf(it);if(!s||seen[it.si])continue;seen[it.si]=1;n[s]=(n[s]||0)+1;}return n;}
// Every set stat that is on for these worn items: partial bonuses, the full bonus, and each worn piece's own lines.
function activeSetStats(items){const n=setCounts(items),out=[],seen={};
  for(const k in n){const S=SETS[k];for(const [need,list] of S.bonus||[])if(n[k]>=need)out.push(...list);if(n[k]>=S.items.length)out.push(...(S.full||[]));}
  for(const it of items){const k=setOf(it);if(!k||seen[it.si])continue;seen[it.si]=1;for(const [need,list] of SET_ITEMS[it.si].sb||[])if(n[k]>=need)out.push(...list);}
  return out;}
function addSetStats(items,s){const n=setCounts(items);s.fullSets=Object.keys(n).filter(k=>n[k]>=SETS[k].items.length); // for the dungeon aura
  for(const a of activeSetStats(items)){if(a.pw)s.pw[a.pw]=true;else if(a.k==='skill')s.skill[a.s]+=a.v;else s[a.k]=(s[a.k]||0)+a.v;}}
const setStatText=a=>a.pw?UPOW[a.pw].t:SET_STAT[a.k]?SET_STAT[a.k].replace('{v}',a.v):affText(a,1,G.char&&G.char.cls);
// Glow for a worn set piece: 'full' with the whole set on, 'on' while any of its set bonuses (or its own green lines)
// are active, '' otherwise (not a set piece, or not enough pieces worn yet).
function setGlow(it,c){const v=setView(it,c);if(!v||!v.pieces.find(p=>p.name===SET_ITEMS[it.si].name).worn)return '';
  if(v.n>=v.total)return 'full';return v.bonus.some(b=>b.on)||v.own.some(o=>o.on)?'on':'';}
// What an item card or tooltip shows for a set piece, against what character c wears now.
function setView(it,c){const k=setOf(it);if(!k)return null;const S=SETS[k],eq=EQ_SLOTS.map(s=>c.equip[s]).filter(Boolean),n=setCounts(eq)[k]||0;
  const worn=new Set(eq.filter(x=>setOf(x)===k).map(x=>x.si)),txt=l=>l.map(setStatText).join(', '),on=it.rarity===5&&worn.has(it.si);
  return {name:S.name,n,total:S.items.length,pieces:S.items.map(si=>({name:SET_ITEMS[si].name,worn:worn.has(si)})),
    own:(SET_ITEMS[it.si].sb||[]).map(([need,l])=>({need,text:txt(l),on:on&&n>=need})),
    bonus:(S.bonus||[]).map(([need,l])=>({need,text:txt(l),on:n>=need})).concat(S.full&&S.full.length?[{need:S.items.length,full:true,text:txt(S.full),on:n>=S.items.length}]:[])};}
// Uniques of this item type that can drop for a character of cls in act/tier `act`.
const uniquesFor=(type,cls,act)=>Object.keys(UNIQUES).filter(k=>{const U=UNIQUES[k];return U.type===type&&U.act<=act&&(!U.cls||U.cls===cls);});
const itemPowers=it=>!it?[]:it.uq&&UNIQUES[it.uq]?UNIQUES[it.uq].pw:it.rb&&RUNEBINDS[it.rb]&&RUNEBINDS[it.rb].pw||[]; // uniques and Runebinds
const hasPw=k=>!!(G.stats&&G.stats.pw&&G.stats.pw[k]);
const pwRank=i=>Math.max(1,rk(i)); // powers that cast a skill use its rank (at least 1, even if unlearned)

// ---------- power effects (called from skills, combat and the update loop) ----------
// Tremorblade: a piercing shockwave along the Cleave direction.
function shockwave(ang,mult){const p=G.p;
  G.proj.push({x:p.x+Math.cos(ang)*20,y:p.y+Math.sin(ang)*20,vx:Math.cos(ang)*520,vy:Math.sin(ang)*520,r:13,col:'#ffd090',life:0.6,from:'p',mult:mult*0.6,pierce:99,wave:true});}
// Maelstrom Grips: drag enemies toward the spinning player (heavy ones and bosses less).
function pullIn(r,step){const p=G.p;for(const e of G.enemies){if(e.dead||e.hidden)continue;const d=dist(e,p);if(d>r||d<p.r+e.r+6)continue;
  const k=e.type==='boss'?0.25:ETYPES[e.type].heavy?0.5:1,m=Math.min(step*k,d-p.r-e.r-6),a=Math.atan2(p.y-e.y,p.x-e.x);moveEnt(e,Math.cos(a)*m,Math.sin(a)*m);}}
// Bloodleap Greaves: Leap Slam's cost in Life (0 = normal Fury cost).
const lifeCost=i=>G.char.cls==='warden'&&i===1&&hasPw('bloodleap')?Math.round(G.stats.life*0.08):0;
// The Last Door: shockwave on block.
function counterBlast(){const p=G.p;if(p.counterCd>0)return;p.counterCd=0.6;aoe(p.x,p.y,130,0.9,{kb:90,splashed:true});
  G.fx.push({type:'ring',x:p.x,y:p.y,r0:12,r1:135,t:0,max:0.3,col:'#cfd6dc'});}
// Worldbreaker: an Earthshatter at a fixed spot (Leap Slam landing).
function earthshatterAt(x,y){const r=pwRank(4);G.fx.push({type:'tele',x,y,r:165,t:0,max:0.35,col:'#ff7a2a'});
  G.delayed.push({t:0.35,fn:()=>{aoe(x,y,165,3.2+0.4*(r-1),{stun:1.5});G.shake=14;G.fx.push({type:'ring',x,y,r0:20,r1:175,t:0,max:0.4,col:'#ff7a2a'});burst(x,y,40,'#c8763a',260);}});}
// Rimeheart Vestment: a free Frost Nova when you get hit.
function autoNova(){const p=G.p;if(p.novaCd>0)return;p.novaCd=4;const r=pwRank(2);
  aoe(p.x,p.y,150,0.8+0.1*(r-1),{freeze:1.8+0.1*r});G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:155,t:0,max:0.4,col:'#9fe4ff'});burst(p.x,p.y,30,'#bff0ff',240);}
// Eye of the Falling Sky: a free Meteor.
function meteorAt(x,y){const r=pwRank(4);G.fx.push({type:'tele',x,y,r:120,t:0,max:0.8,col:'#ff5a1a'});
  G.delayed.push({t:0.8,fn:()=>{aoe(x,y,120,3.8+0.45*(r-1),{});G.shake=12;burst(x,y,50,'#ff8a2a',300);G.fx.push({type:'ring',x,y,r0:20,r1:130,t:0,max:0.35,col:'#ffb04a'});
    G.hazards.push({x,y,r:110,t:3,tick:0,mult:0.3+0.04*(r-1)});}});}
// Litany of Ash: turn a bolt toward the nearest enemy.
function homeIn(q,dt){const e=nearest(q.x,q.y,320);if(!e)return;const sp=Math.hypot(q.vx,q.vy),a=Math.atan2(q.vy,q.vx),want=Math.atan2(e.y-q.y,e.x-q.x);
  let d=want-a;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;const na=a+clamp(d,-7*dt,7*dt);q.vx=Math.cos(na)*sp;q.vy=Math.sin(na)*sp;}
// Heart of the Deep: emergency heal + knockback, before death is checked.
function lastBreath(){const p=G.p,s=G.stats;if(p.lbCd>0||p.hp<=0||p.hp>=s.life*0.3)return;p.lbCd=30;
  healPlayer(s.life*0.3);aoe(p.x,p.y,170,0.5,{kb:150,splashed:true});G.shake=10;floatText(p.x,p.y-40,'Last Breath','#ff9a3a',true);
  G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:180,t:0,max:0.45,col:'#ff9a3a'});}
// Per-frame powers: cooldown timers, burning aura, fire trail, falling meteors.
function powerTick(dt){const p=G.p;if(p.dead)return;
  for(const k of ['counterCd','novaCd','lbCd'])if(p[k]>0)p[k]-=dt;
  if(G.inTown)return;
  if(hasPw('burnAura')){p.auraT=(p.auraT||0)-dt;if(p.auraT<=0){p.auraT=0.5;aoe(p.x,p.y,AURA_R,AURA_MULT,{splashed:true,quiet:true,dot:true});}}
  if(hasPw('fireTrail')){const L=p.trail||(p.trail={x:p.x,y:p.y});if(Math.hypot(p.x-L.x,p.y-L.y)>26){L.x=p.x;L.y=p.y;
    const tr=G.hazards.filter(h=>h.trail);if(tr.length>=14)G.hazards.splice(G.hazards.indexOf(tr[0]),1);
    G.hazards.push({x:p.x,y:p.y,r:36,t:2.5,tick:0.25,mult:TRAIL_MULT,trail:true,quiet:true});}}
  if(hasPw('coreFlare')){p.flareT=(p.flareT==null?5:p.flareT)-dt;if(p.flareT<=0){p.flareT=5;aoe(p.x,p.y,170,1.6,{splashed:true});
    G.fx.push({type:'ring',x:p.x,y:p.y,r0:16,r1:175,t:0,max:0.4,col:'#ff6a1a'});burst(p.x,p.y,36,'#ffb04a',260);G.hazards.push({x:p.x,y:p.y,r:120,t:2,tick:0.25,mult:0.2,quiet:true});}}
  if(hasPw('skyfall')){p.skyT=(p.skyT==null?3:p.skyT)-dt;if(p.skyT<=0){const e=nearest(p.x,p.y,420);if(e){meteorAt(e.x,e.y);p.skyT=8;}else p.skyT=0.5;}}
}
const AURA_R=115;
// Cinderguard Vow: a Cleave leaves a patch of burning ground in front of you (at most 8 patches at once).
function cinderPatch(ang,reach){const p=G.p,x=p.x+Math.cos(ang)*reach*0.6,y=p.y+Math.sin(ang)*reach*0.6;
  const own=G.hazards.filter(h=>h.cinder);if(own.length>=8)G.hazards.splice(G.hazards.indexOf(own[0]),1);
  G.hazards.push({x,y,r:48,t:2.5,tick:0.25,mult:CINDER_MULT,cinder:true,quiet:true});}
// Frostbound Regalia: a frozen enemy that dies bursts into 8 piercing ice shards.
function iceShards(e){const n=8;for(let k=0;k<n;k++){const a=k/n*TAU;
  G.proj.push({x:e.x,y:e.y,vx:Math.cos(a)*460,vy:Math.sin(a)*460,r:6,col:'#bff0ff',life:0.5,from:'p',mult:0.6,pierce:1,hits:new Set([e])});}
  burst(e.x,e.y,16,'#dff6ff',200);}
