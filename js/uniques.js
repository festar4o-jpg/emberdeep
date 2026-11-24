'use strict';
// Unique items: each one is a named item of a fixed type with 1–2 powers that change how a skill or the character
// plays (the random affixes still roll on top). act = the first act / base tier it can drop in, so later acts add
// stronger uniques to the pool. cls = whose skills the powers use (null: anyone). Class uniques only drop for that class.
// Live numbers for a power's card: "m" times your average hit (weapon damage with your current gear, level and
// damage bonuses, before crits), e.g. "20% weapon damage (≈34) per second".
const pwHit=m=>{const s=G.stats;return s?Math.max(1,Math.round((s.dmin+s.dmax)/2*s.levelMul*(1+s.dmg/100)*(1+s.spell/100)*m)):0;};
const pwLife=f=>G.stats?Math.round(G.stats.life*f):0;
const pwDet=(m,what)=>`${Math.round(m*100)}% weapon damage (≈${pwHit(m)})${what?' '+what:''}`;
// Fire powers hit every 0.5 s for this much of your weapon damage per hit.
const AURA_MULT=0.10,TRAIL_MULT=0.12,CINDER_MULT=0.14,WILD_MULT=0.20;
// Ignite (Pyre): a burning enemy takes this much weapon damage per second for IGNITE_T seconds.
const IGNITE_MULT=0.30,IGNITE_T=3;
// Boss trophy power numbers.
const BONE_KILLS=8,BONE_MULT=1.5,ASH_CH=0.35,ASH_MULT=0.4,ROT_MULT=0.3,ROT_MAX=6;
// v1.0.99 boss uniques: Ossuary Mantle, Tyrant's Stride, Plaguebearer's Locket, Rimebound Seal, Grasp of the Cinder King
const BONE_WARD=2,BONE_WARD_MAX=10,BONE_WARD_T=5,FURY_HITS=3,FURY_MUL=1.5,FURY_T=3,PLAGUE_CH=20,PLAGUE_R=110,
  BITE_SLOW=0.3,BITE_MUL=1.2,EMBER_EVERY=4,EMBER_MULT=0.8,EMBER_R=70;
const UPOW={
  // v1.0.71 (G.sk: the skill a hit comes from, game.js)
  cleaveBleed:{cls:'warden',t:'Cleave makes every enemy it hits bleed',d:()=>`Bleeds for ${pwHit(0.8/3*(1+0.12*(pwRank(0)-1)))} per second for 3s`},
  warcryShield:{cls:'warden',t:'War Cry also raises a barrier that soaks damage for 6s',d:()=>`Absorbs ${pwLife(0.25)} damage (25% of your Life)`},
  leapFire:{cls:'warden',t:'Leap Slam leaves burning ground where you land',d:()=>pwDet(0.35*2,'per second for 3s')},
  whirlCrit:{cls:'warden',t:'Whirlwind hits always crit',d:()=>`Every spin hit is a crit: ${pwHit((0.5+0.07*(pwRank(2)-1))*(1+(G.stats?G.stats.critd:50)/100))} each`},
  shatterArmor:{cls:'warden',t:'Earthshatter breaks armour: enemies it hits take 25% more damage for 5s',d:()=>'+25% damage taken for 5 seconds'},
  boltChain:{cls:'arcanist',t:'Arcane Bolt jumps to a second enemy',d:()=>pwDet(0.6*(0.95+0.12*(pwRank(0)-1)),'to the next enemy within 220')},
  novaSpikes:{cls:'arcanist',t:'Frost Nova also fires 8 ice shards outward',d:()=>pwDet(0.5+0.05*(pwRank(2)-1),'per shard')},
  meteorShower:{cls:'arcanist',t:'Meteor calls down 3 smaller meteors around it',d:()=>pwDet(0.4*(3.8+0.45*(pwRank(4)-1)),'each, a moment later')},
  chainBlast:{cls:'arcanist',t:"Chain Lightning's last jump explodes",d:()=>pwDet(1.5*(1.25+0.15*(pwRank(3)-1)),'in a small area')},
  manaShield:{cls:'arcanist',t:'25% of damage you take is paid with Mana instead',d:()=>`Up to 25% of each hit, while you have ${G.stats?Math.round(G.stats.res*0.1):10}+ Mana`},
  soulHarvest:{cls:null,t:'Each kill gives a Soul (up to 10): +2% damage per Soul; they fade one by one without kills',d:()=>'Up to +20% damage at 10 Souls; one fades each second after 4s without a kill'},
  thornBurst:{cls:null,t:'When you are hit, thorns burst from you (once a second)',d:()=>pwDet(0.6,'to every enemy around you')},
  arcaneFan:{cls:'arcanist',t:'Arcane Bolt fires two more bolts in a fan',d:()=>pwDet(0.6*(0.95+0.12*(pwRank(0)-1)),'per extra bolt')},
  shockwave:{cls:'warden',t:'When Cleave hits an enemy, it fires a shockwave forward that passes through enemies',d:()=>pwDet(0.6*(1+0.12*(pwRank(0)-1)),'to every enemy it passes (no hit, no shockwave)')},
  pull:{cls:'warden',t:'Whirlwind pulls nearby enemies in',d:()=>'Pulls from almost 3× Whirlwind\'s reach, 4 times per second (heavy monsters half as far, bosses a quarter)'},
  bloodleap:{cls:'warden',t:'Leap Slam has no cooldown but costs 8% of your Life instead of Fury',d:()=>`Costs ${pwLife(0.08)} Life per leap now · `+pwDet(1.8+0.22*(pwRank(1)-1),'and stuns')},
  counter:{cls:'warden',t:'Blocking an attack releases a shockwave around you',d:()=>pwDet(0.9,'to enemies around you')},
  quake:{cls:'warden',t:'Leap Slam sets off Earthshatter where you land',d:()=>pwDet(3.2+0.4*(pwRank(4)-1),'in a wide area, stuns')},
  faultline:{cls:'warden',t:'Earthshatter cooldown is halved',d:()=>{const c=SKILLS.warden[4].cd*(1-(G.stats.cdr||0)/100);return `Cooldown ${c.toFixed(1)}s → ${(c/2).toFixed(1)}s · `+pwDet(3.2+0.4*(pwRank(4)-1),'per quake');}},
  split:{cls:'arcanist',t:'Fireball splits into 3',d:()=>'3 fireballs, each '+pwDet(0.75*(1.7+0.22*(pwRank(1)-1)),'in an area')+' (one normal Fireball: '+pwHit(1.7+0.22*(pwRank(1)-1))+')'},
  frostward:{cls:'arcanist',t:'Frost Nova casts itself when you are hit (every 4s at most)',d:()=>pwDet(0.8+0.1*(pwRank(2)-1),'to enemies around you, freezes')},
  endless:{cls:'arcanist',t:'Chain Lightning never stops bouncing while you have over 50% Mana',d:()=>`Up to 30 jumps instead of ${Math.min(8,3+Math.floor((pwRank(3)-1)/2))}, each `+pwDet(1.25+0.15*(pwRank(3)-1),'')},
  skyfall:{cls:'arcanist',t:'A Meteor falls on a nearby enemy every 8s',d:()=>pwDet(3.8+0.45*(pwRank(4)-1),'on impact')+' · then '+pwDet(2*(0.3+0.04*(pwRank(4)-1)),'per second for 3s')},
  blast:{cls:'arcanist',t:'Arcane Bolt explodes on impact',d:()=>'The explosion deals '+pwDet(0.95+0.12*(pwRank(0)-1),'to every enemy around the hit')},
  homing:{cls:'arcanist',t:'Arcane Bolts seek out enemies',d:()=>'Bolts curve toward the nearest enemy (same damage: '+pwDet(0.95+0.12*(pwRank(0)-1),'')+')'},
  burnAura:{t:'Burning aura: enemies close to you take fire damage',d:()=>pwDet(2*AURA_MULT,'per second to each enemy close to you')},
  lastBreath:{t:'Dropping below 30% Life heals you for 30% and blasts enemies away (every 30s at most)',d:()=>`Heals ${pwLife(0.3)} Life · blast `+pwDet(0.5,'to enemies around you')},
  fireTrail:{t:'You leave a trail of fire that burns enemies',d:()=>pwDet(2*TRAIL_MULT,'per second to enemies in the fire')},
  potionReset:{t:'Drinking a potion resets all your skill cooldowns',d:()=>`Each potion also heals ${pwLife(0.45)} Life (45%)`},
  ouroboros:{t:'Skills have a 30% chance not to go on cooldown',d:()=>'About 3 of every 10 skill casts are ready again at once (not the basic attack)'},
  // set bonus powers
  cinderCleave:{cls:'warden',t:'Cleave leaves burning ground',d:()=>pwDet(2*CINDER_MULT,'per second to enemies on it')},
  shatter:{cls:'arcanist',t:'Frozen enemies explode into ice shards when they die',d:()=>'8 shards, each '+pwDet(0.6,'')},
  stormweave:{cls:'arcanist',t:'Chain Lightning bounces 4 extra times',d:()=>{const n=Math.min(8,3+Math.floor((pwRank(3)-1)/2));return `${n} → ${n+4} enemies, each `+pwDet(1.25+0.15*(pwRank(3)-1),'');}},
  oathspin:{cls:'warden',t:'Whirlwind lasts twice as long',d:()=>{const t=2+0.1*(pwRank(2)-1);return `${t.toFixed(1)}s → ${(2*t).toFixed(1)}s of spinning, `+pwDet(0.5+0.07*(pwRank(2)-1),'4 times per second');}},
  veilCrit:{t:'Critical hits heal you for 1% of your Life',d:()=>`${pwLife(0.01)} Life per critical hit (${Math.round(G.stats.crit)}% crit chance)`},
  // Runebind powers (each pairs with a unique: see COMBOS)
  ignite:{t:'Your hits set enemies on fire',d:()=>pwDet(IGNITE_MULT,`per second for ${IGNITE_T}s (a new hit renews the fire)`)},
  bloodrage:{t:'Below 50% Life you deal 25% more damage, and every kill heals 2% Life',d:()=>`+25% damage below ${pwLife(0.5)} Life · ${pwLife(0.02)} Life per kill`},
  stormbeat:{t:'Critical hits take 0.25s off all your skill cooldowns',d:()=>`${Math.round(G.stats.crit)}% crit chance · at most 4 times per second`},
  cometDash:{t:'Your dodge ends in a fiery impact',d:()=>pwDet(1.2,'to enemies where you land')},
  // set power (Bulwark of the Hollow King; its own shield means it can't meet The Last Door)
  kingsWrath:{cls:'warden',t:'Blocking an attack gives you 30% more damage for 3s',d:()=>`${Math.round(G.stats.block)}% block chance · +30% damage for 3s after each block`},
  coreFlare:{t:'Every 5s a Core Flare erupts around you, burning nearby enemies',d:()=>pwDet(1.6,'around you')+' · then '+pwDet(0.4,'per second for 2s')},
  // boss trophy powers (each only on its act boss's own unique: see BOSS_LOOT)
  boneNova:{t:`Every ${BONE_KILLS} kills, a Bone Nova bursts from you`,d:()=>pwDet(BONE_MULT,`to every enemy around you · ${G.p&&G.p.boneN||0}/${BONE_KILLS} kills`)},
  ashChain:{t:`${Math.round(ASH_CH*100)}% of your hits lash a second enemy nearby with a chain of ash`,d:()=>pwDet(ASH_MULT,'to the second enemy')},
  rotBurst:{t:'Enemies you kill burst into a rot cloud that eats at other enemies',d:()=>pwDet(2*ROT_MULT,'per second for 3s in the cloud')+` · up to ${ROT_MAX} clouds`},
  rimeSkin:{t:'An enemy that hits you is frozen solid (each enemy every 4s at most)',d:()=>'Frozen for 1.5s (bosses 0.5s): frozen enemies can\'t move or attack'},
  boneWard:{t:`Each kill adds a bone shard: ${BONE_WARD}% less damage taken per shard, up to ${BONE_WARD_MAX}; they fade ${BONE_WARD_T}s after your last kill`,d:()=>{const n=G.p&&G.p.wardT>0?G.p.wardN||0:0;return `Up to ${BONE_WARD*BONE_WARD_MAX}% less damage · now ${n} shards (${BONE_WARD*n}%)`;}},
  dodgeFury:{t:`After you dodge, your next ${FURY_HITS} hits deal ${Math.round((FURY_MUL-1)*100)}% more damage (for ${FURY_T}s)`,d:()=>`${G.p&&G.p.dfT>0?G.p.dfN||0:0} empowered hits left`},
  plagueSpread:{t:`+${PLAGUE_CH}% chance to Poison, and a poisoned enemy that dies passes its poison to every enemy nearby`,d:()=>`Spreads to enemies within ${PLAGUE_R / TILE | 0} tiles`},
  coldBite:{t:`Your hits Chill enemies (${Math.round(BITE_SLOW*100)}% slower), and Chilled or Frozen enemies take ${Math.round((BITE_MUL-1)*100)}% more damage from you`,d:()=>`Chilled for 2s (${Math.round(BITE_SLOW*100)}% slower) · +${Math.round((BITE_MUL-1)*100)}% damage to them · this Chill never builds a Freeze on its own`},
  emberStrike:{t:`Every ${EMBER_EVERY}th hit erupts in fire around its target`,d:()=>pwDet(EMBER_MULT,`to enemies around the target · ${G.p&&G.p.emberN||0}/${EMBER_EVERY}`)},
  kingsPyre:{t:'Each kill stokes the Pyre: +3% damage per stack, up to 10 stacks; they fade 4s after your last kill',d:()=>`Up to +30% damage · now ${G.p&&G.p.pyreT>0?G.p.pyreN||0:0} stacks (+${3*(G.p&&G.p.pyreT>0?G.p.pyreN||0:0)}%)`}
};
// Combos: a unique and a Runebind (or set) with matching powers do something extra when both are worn.
const COMBOS=[
  {a:'burnAura',b:'ignite',name:'Bonfire',t:'Your burning aura also sets enemies on fire',d:()=>'Enemies near you take '+pwDet(2*AURA_MULT+IGNITE_MULT,'per second in total')},
  {a:'lastBreath',b:'bloodrage',name:'Second Wind',t:'Last Breath recharges in 20s instead of 30s, and Bloodrage stays on for 5s after it'},
  {a:'ouroboros',b:'stormbeat',name:'Eye of the Storm',t:'When a skill comes back free, your other skills\' cooldowns drop by 1s'},
  {a:'fireTrail',b:'cometDash',name:'Wildfire',t:'Your dodge impact leaves burning ground for 3s',d:()=>pwDet(2*WILD_MULT,'per second')}
];
const combo=n=>{const C=COMBOS.find(x=>x.name===n);return !!C&&hasPw(C.a)&&hasPw(C.b);};
// Which item gives a power (for "with Pyre" on a card): a unique, a Runebind or a set.
function pwSource(k){for(const u in UNIQUES)if(UNIQUES[u].pw.includes(k))return UNIQUES[u].name;
  if(typeof RUNEBINDS!=='undefined')for(const r in RUNEBINDS)if((RUNEBINDS[r].pw||[]).includes(k))return RUNEBINDS[r].name+' (rune word)';
  for(const s in SETS)if(SETS[s].full.some(f=>f.pw===k))return SETS[s].name+' (full set)';return '?';}
const UNIQUES={
  // v1.0.72: map uniques, only from maps (boss 'map': Sigil Tier mt and up) or a Citadel's guardian (boss 'ash'/'frost'/'rot');
  // each combines two existing powers (like the Hollow Sun's), never dropping anywhere else
  gravecaller:{name:"Gravecaller's Maul",type:'weapon',wt:'maul',cls:'warden',act:5,boss:'map',mt:6,pw:['quake','bloodrage']},
  stormguard:{name:'Stormguard Bulwark',type:'shield',cls:'warden',act:5,boss:'map',mt:6,pw:['counter','stormbeat']},
  riftwalker:{name:'Riftwalker Greaves',type:'boots',cls:null,act:5,boss:'map',mt:11,strong:1,pw:['cometDash','fireTrail']},
  ashwarden:{name:"The Ashen Warden's Visor",type:'helm',cls:'warden',act:5,boss:'ash',pw:['burnAura','cinderCleave']},
  voidprism:{name:'Prism of the Void',type:'focus',kind:'orb',cls:'arcanist',act:5,boss:'map',mt:6,pw:['split','homing']},
  glacierheart:{name:"Glacier's Heart",type:'body',kind:'robe',cls:'arcanist',act:5,boss:'map',mt:11,strong:1,pw:['frostward','shatter']},
  rimecrown:{name:"The Rime Sentinel's Crown",type:'helm',cls:'arcanist',act:5,boss:'frost',pw:['rimeSkin','skyfall']},
  endlessnight:{name:'Ring of the Endless Night',type:'ring',cls:null,act:5,boss:'map',mt:6,pw:['veilCrit','ignite']},
  matrongirdle:{name:"The Matron's Rotting Girdle",type:'belt',cls:null,act:5,boss:'rot',pw:['rotBurst','potionReset']},
  cartographer:{name:"The Cartographer's Eye",type:'amulet',cls:null,act:5,boss:'map',mt:11,strong:1,pw:['ouroboros','ashChain']},
  // v1.0.71: thirteen more, one new power each
  butcher:{name:"The Butcher's Hook",type:'weapon',wt:'axe',cls:'warden',act:2,boss:1,pw:['cleaveBleed']},
  warlord:{name:"Warlord's Visage",type:'helm',cls:'warden',act:3,boss:2,pw:['warcryShield']},
  emberfall:{name:'Emberfall Sabatons',type:'boots',cls:'warden',act:4,pw:['leapFire']},
  cyclone:{name:'Cyclone Edge',type:'weapon',wt:'greatsword',cls:'warden',act:4,boss:3,strong:1,pw:['whirlCrit']},
  quakeplate:{name:'Quakeplate',type:'body',kind:'plate',cls:'warden',act:3,pw:['shatterArmor']},
  echoes:{name:'Wand of Echoes',type:'weapon',wt:'wand',cls:'arcanist',act:1,boss:0,pw:['boltChain']},
  winter:{name:'Tome of Endless Winter',type:'focus',kind:'tome',cls:'arcanist',act:2,pw:['novaSpikes']},
  starcaller:{name:'Starcaller',type:'weapon',wt:'staff',cls:'arcanist',act:4,boss:3,strong:1,pw:['meteorShower']},
  stormband:{name:'Band of the Stormfront',type:'ring',cls:'arcanist',act:3,pw:['chainBlast']},
  sorrows:{name:'Mantle of Sorrows',type:'body',kind:'robe',cls:'arcanist',act:4,pw:['manaShield']},
  soulcage:{name:'Soulcage Pendant',type:'amulet',cls:null,act:3,pw:['soulHarvest']},
  briar:{name:'The Briar Coat',type:'body',kind:'leather',cls:null,act:2,pw:['thornBurst']},
  ninth:{name:'Edge of the Ninth Circle',type:'weapon',wt:'spellblade',cls:'arcanist',act:2,boss:1,pw:['arcaneFan']},
  // the Hollow Sun's own (pinnacle.js): three powers each, never anywhere else
  dawnbreaker:{name:'Dawnbreaker',type:'weapon',wt:'greatsword',cls:'warden',act:5,boss:'sun',strong:1,pw:['cinderCleave','kingsWrath','coreFlare']},
  eclipseaegis:{name:'Aegis of the Eclipse',type:'shield',cls:'warden',act:5,boss:'sun',strong:1,pw:['counter','rimeSkin','lastBreath']},
  hollowheart:{name:'Heart of the Hollow Sun',type:'weapon',wt:'staff',cls:'arcanist',act:5,boss:'sun',strong:1,pw:['skyfall','stormweave','coreFlare']},
  corona:{name:'The Last Corona',type:'amulet',cls:null,act:5,boss:'sun',strong:1,pw:['burnAura','kingsPyre','ignite']},
  tremorblade:{name:'Tremorblade',type:'weapon',wt:'sword',cls:'warden',act:1,boss:0,pw:['shockwave']},
  maelstrom:{name:'Maelstrom Grips',type:'gloves',cls:'warden',act:2,pw:['pull']},
  bloodleap:{name:'Bloodleap Greaves',type:'boots',cls:'warden',act:3,pw:['bloodleap']},
  lastdoor:{name:'The Last Door',type:'shield',cls:'warden',act:4,pw:['counter']},
  worldbreaker:{name:'Worldbreaker',type:'weapon',wt:'maul',cls:'warden',act:5,boss:4,strong:1,pw:['quake','faultline']},
  scattering:{name:'Orb of Scattered Flame',type:'focus',kind:'orb',cls:'arcanist',act:1,pw:['split']},
  rimeheart:{name:'Rimeheart Vestment',type:'body',kind:'robe',cls:'arcanist',act:2,pw:['frostward']},
  stormcaller:{name:'Stormcaller',type:'weapon',wt:'rod',cls:'arcanist',act:3,boss:2,pw:['endless']},
  fallingsky:{name:'Eye of the Falling Sky',type:'helm',cls:'arcanist',act:4,pw:['skyfall']},
  litany:{name:'Litany of Ash',type:'weapon',wt:'demonstaff',cls:'arcanist',act:5,boss:4,strong:1,pw:['blast','homing']},
  coalheart:{name:'Coal Heart',type:'ring',cls:null,act:1,pw:['burnAura']},
  deepheart:{name:'Heart of the Deep',type:'amulet',cls:null,act:2,pw:['lastBreath']},
  ashwalker:{name:'Ashwalker Treads',type:'boots',cls:null,act:3,pw:['fireTrail']},
  alchemist:{name:'Coil of the Alchemist',type:'belt',cls:null,act:4,pw:['potionReset']},
  ouroboros:{name:'Ouroboros Loop',type:'ring',cls:null,act:5,strong:1,pw:['ouroboros']},
  // boss trophies: boss = act index; only that act's boss drops them (any cycle), never other monsters or the shop
  varrokcrown:{name:"Varrok's Hollow Crown",type:'helm',cls:null,act:1,boss:0,pw:['boneNova']},
  tyrantchain:{name:'Shackles of the Ash Tyrant',type:'gloves',cls:null,act:2,boss:1,pw:['ashChain']},
  rotbrood:{name:'Brood of the Rot Mother',type:'ring',cls:null,act:3,boss:2,pw:['rotBurst']},
  frozenshard:{name:'Shard of the Frozen King',type:'amulet',cls:null,act:4,boss:3,pw:['rimeSkin']},
  cinderbrand:{name:'Brand of the Cinder King',type:'belt',cls:null,act:5,boss:4,pw:['kingsPyre']},
  // v1.0.99: one more of its own per act boss (each act boss's table: its trophy, these, and a Warden and an Arcanist unique)
  ossuary:{name:'Ossuary Mantle',type:'body',kind:'plate',cls:null,act:1,boss:0,pw:['boneWard']},
  tyrantstride:{name:"Tyrant's Stride",type:'boots',cls:null,act:2,boss:1,pw:['dodgeFury']},
  plaguelocket:{name:"Plaguebearer's Locket",type:'amulet',cls:null,act:3,boss:2,pw:['plagueSpread']},
  rimeseal:{name:'Rimebound Seal',type:'ring',cls:null,act:4,boss:3,pw:['coldBite']},
  cindergrasp:{name:'Grasp of the Cinder King',type:'gloves',cls:null,act:5,boss:4,pw:['emberStrike']}
};
// Act boss drop tables (v1.0.99, like Diablo 2 / PoE2 bosses): BOSS_LOOT[act] = the uniques only that act's boss drops
// (any cycle; never other monsters, the shop or the set/unique guarantee). Each kill: BOSS_UQ_CH for one of them,
// picked among those your class can use (class uniques only for their class); and BOSS_SET_CH for a set piece.
const BOSS_LOOT=[0,1,2,3,4].map(a=>Object.keys(UNIQUES).filter(k=>UNIQUES[k].boss===a));
const BOSS_UQ_CH=0.4,BOSS_SET_CH=0.3;
const bossLootFor=(a,cls)=>(BOSS_LOOT[a]||[]).filter(k=>!UNIQUES[k].cls||UNIQUES[k].cls===cls);
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
const SET_STAT={gold:'+{v}% Gold Found',rarity:'+{v}% Item Rarity'};
const SETS={
  wanderer:{aura:'255,206,72',name:"Wanderer's Fortune",cls:null,act:1,items:['wfband','wfsash'],bonus:[],full:[{k:'gold',v:20},{k:'rarity',v:25}]},
  cinderguard:{aura:'255,140,40',name:'Cinderguard Vow',cls:'warden',act:3,items:['cgblade','cgseal','cgplate','cgtreads','cggrips'],
    bonus:[[2,[{k:'dmg',v:15},{k:'loh',v:4}]]],full:[{pw:'cinderCleave'}]},
  hollowking:{aura:'140,255,215',name:'Bulwark of the Hollow King',cls:'warden',act:3,items:['hkcrown','hkpendant','hkaegis'],
    bonus:[[2,[{k:'block',v:8},{k:'armor',v:40}]]],full:[{pw:'kingsWrath'}]},
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
// Boss trophies: every act boss can drop one of its own uniques (BOSS_LOOT), and has a good chance at a set piece.
// The endless depths add 10%. (Item Rarity doesn't change these: they are extra drops, not the rarity of a drop.)
function bossTrophy(e){const c=G.char,ks=bossLootFor(actIdx(G.depth),c.cls),k=ks.length?pick(ks):null,U=k&&UNIQUES[k],mul=1,plus=PD()>25?0.1:0;
  if(U&&Math.random()<Math.min(1,BOSS_UQ_CH*mul+plus)){const it=genItem(PD()+3,c.cls,0,U.type,3,U.wt,dropAct(PD()),null,k);dropItem(e.x+rand(-40,40),e.y+rand(-40,40),it);toast('Boss trophy!',U.name);}
  if(Math.random()<Math.min(1,BOSS_SET_CH*mul+plus)){const act=dropAct(PD()),ks=Object.keys(SET_ITEMS).filter(si=>{const S=SETS[SET_ITEMS[si].set];return S.act<=act&&(!S.cls||S.cls===c.cls)&&inSetZone(S);});
    if(ks.length)dropItem(e.x+rand(-40,40),e.y+rand(-40,40),genItem(PD()+3,c.cls,0,null,0,null,act,pick(ks)));}}
// v1.0.99 boss unique powers. Hooks: game.js hitEnemy (bossPwHitMul, bossPwAfter), killEnemy (plagueSpread),
// dmgPlayer (boneWardMul), tryDodge (Tyrant's Stride), bossPwTick (timers, from game.js), calcStats (Locket's poison chance).
const boneWardMul=()=>{const p=G.p;return p&&p.wardT>0&&hasPw('boneWard')?1-BONE_WARD*(p.wardN||0)/100:1;};
const direct=o=>!o.dot&&!o.splashed&&!o.haz&&!o.chained;
function bossPwHitMul(e,o){let m=1;const p=G.p;
  if(p.dfT>0&&p.dfN>0&&direct(o)&&hasPw('dodgeFury')){m*=FURY_MUL;if(--p.dfN<=0)p.dfT=0;}
  if((e.chillT>0||e.frozen>0)&&hasPw('coldBite'))m*=BITE_MUL;return m;}
function bossPwAfter(e,o){if(!direct(o))return;const p=G.p;
  if(hasPw('coldBite')&&!e.dead&&e.hp>0)chillHit(e,BITE_SLOW,2,true);
  if(hasPw('emberStrike')){p.emberN=(p.emberN||0)+1;if(p.emberN>=EMBER_EVERY){p.emberN=0;const x=e.x,y=e.y;fxExplosion(x,y,EMBER_R);aoe(x,y,EMBER_R,EMBER_MULT,{splashed:true});}}}
function plagueSpread(e){if(!e.pois||!e.pois.length)return;const live=e.pois.filter(q=>q.t>0);if(!live.length)return;
  for(const o of G.enemies){if(o===e||o.dead||o.hidden||Math.hypot(o.x-e.x,o.y-e.y)>PLAGUE_R+o.r)continue;
    if(!o.pois)o.pois=[];for(const q of live)o.pois.push({dps:q.dps,t:q.t});if(o.pois.length>AIL_POISON_MAX)o.pois.splice(0,o.pois.length-AIL_POISON_MAX);}
  G.fx.push({type:'ring',x:e.x,y:e.y,r0:8,r1:PLAGUE_R,t:0,max:0.3,col:AIL_COL.poison});}
function bossPwTick(p,dt){if(p.wardT>0){p.wardT-=dt;if(p.wardT<=0)p.wardN=0;}if(p.dfT>0){p.dfT-=dt;if(p.dfT<=0)p.dfN=0;}}
// Trophy powers that trigger on a kill.
function trophyKill(e){const p=G.p;if(p.dead)return;
  if(hasPw('boneWard')){p.wardN=Math.min(BONE_WARD_MAX,(p.wardT>0?p.wardN||0:0)+1);p.wardT=BONE_WARD_T;}
  if(hasPw('kingsPyre')){p.pyreN=Math.min(10,(p.pyreT>0?p.pyreN||0:0)+1);p.pyreT=4;}
  if(hasPw('rotBurst')){const own=G.hazards.filter(h=>h.rot);if(own.length>=ROT_MAX)G.hazards.splice(G.hazards.indexOf(own[0]),1);G.hazards.push({sk:G.sk,x:e.x,y:e.y,r:75,t:3,tick:0.5,mult:ROT_MULT,rot:true,quiet:true});}
  if(hasPw('boneNova')){p.boneN=(p.boneN||0)+1;if(p.boneN>=BONE_KILLS){p.boneN=0;G.fx.push({type:'ring',x:p.x,y:p.y,r0:12,r1:180,t:0,max:0.4,col:'#e8e0c0'});burst(p.x,p.y,30,'#e8e0c0',260);aoe(p.x,p.y,175,BONE_MULT,{splashed:true});}}}
// Shackles of the Ash Tyrant: a direct hit may lash the nearest other enemy.
function ashChain(e){let o=null,bd=170;for(const x of G.enemies){if(x===e||x.dead||x.hidden||x.spawnT>0)continue;const d=Math.hypot(x.x-e.x,x.y-e.y);if(d<bd){bd=d;o=x;}}
  if(!o)return;G.fx.push({type:'lflash',x:e.x,y:e.y,a:Math.atan2(o.y-e.y,o.x-e.x),len:bd,w:8,t:0,max:0.2,col:'#e0a860'});hitEnemy(o,ASH_MULT,{splashed:true,chained:true});}
// Shard of the Frozen King: whoever hits you freezes.
function rimeSkin(src){if(!src||src.dead||G.time-(src.rimeAt??-99)<4)return;src.rimeAt=G.time;src.frozen=Math.max(src.frozen||0,src.type==='boss'?0.5:1.5);
  floatText(src.x,src.y-src.r-16,'Frozen','#bfe4ff',false);burst(src.x,src.y,10,'#dff4ff',140);}
// The act 5 boss: 40% chance of one extra Relics of the Ember Core piece.
function emberCoreDrop(e){if(Math.random()>=0.4)return;const si=pick(SETS.embercore.items);dropItem(e.x+rand(-40,40),e.y+rand(-40,40),genItem(PD()+3,G.char.cls,0,null,0,null,5,si));}
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
const uniquesFor=(type,cls,act)=>Object.keys(UNIQUES).filter(k=>{const U=UNIQUES[k];return U.boss==null&&U.type===type&&U.act<=act&&(!U.cls||U.cls===cls);});
const itemPowers=it=>!it?[]:it.uq&&UNIQUES[it.uq]?(it.cpw&&UPOW[it.cpw]?UNIQUES[it.uq].pw.concat([it.cpw]):UNIQUES[it.uq].pw):it.rb&&RUNEBINDS[it.rb]&&RUNEBINDS[it.rb].pw||[]; // uniques and Runebinds
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
function earthshatterAt(x,y){const r=pwRank(4);G.fx.push({type:'tele',x,y,r:165,t:0,max:0.35,col:'#ff7a2a',own:1});
  G.delayed.push({sk:G.sk,t:0.35,fn:()=>{aoe(x,y,165,3.2+0.4*(r-1),{stun:1.5});G.shake=14;G.hitStop=0.07;fxCracks(x,y,175);G.fx.push({type:'ring',x,y,r0:20,r1:175,t:0,max:0.4,col:'#ff7a2a'});burst(x,y,40,'#c8763a',260);}});}
// Rimeheart Vestment: a free Frost Nova when you get hit.
function autoNova(){const p=G.p;if(p.novaCd>0)return;p.novaCd=4;const r=pwRank(2);
  aoe(p.x,p.y,150,0.8+0.1*(r-1),{freeze:1.8+0.1*r});G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:155,t:0,max:0.4,col:'#9fe4ff'});burst(p.x,p.y,30,'#bff0ff',240);}
// Eye of the Falling Sky: a free Meteor.
function meteorAt(x,y){const r=pwRank(4);G.fx.push({type:'tele',x,y,r:120,t:0,max:0.8,col:'#ff5a1a',own:1,meteor:1});
  G.delayed.push({sk:G.sk,t:0.8,fn:()=>{aoe(x,y,120,3.8+0.45*(r-1),{});G.shake=12;G.hitStop=0.06;fxExplosion(x,y,120);burst(x,y,50,'#ff8a2a',300);G.fx.push({type:'ring',x,y,r0:20,r1:130,t:0,max:0.35,col:'#ffb04a'});
    G.hazards.push({sk:G.sk,x,y,r:110,t:3,tick:0,mult:0.3+0.04*(r-1)});}});}
// Litany of Ash: turn a bolt toward the nearest enemy.
function homeIn(q,dt){const e=nearest(q.x,q.y,320);if(!e)return;const sp=Math.hypot(q.vx,q.vy),a=Math.atan2(q.vy,q.vx),want=Math.atan2(e.y-q.y,e.x-q.x);
  let d=want-a;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;const na=a+clamp(d,-7*dt,7*dt);q.vx=Math.cos(na)*sp;q.vy=Math.sin(na)*sp;}
// Heart of the Deep: emergency heal + knockback, before death is checked.
function lastBreath(){const p=G.p,s=G.stats;if(p.lbCd>0||p.hp<=0||p.hp>=s.life*0.3)return;const sw=combo('Second Wind');p.lbCd=sw?20:30;if(sw)p.rageT=5;
  healPlayer(s.life*0.3);aoe(p.x,p.y,170,0.5,{kb:150,splashed:true});G.shake=10;floatText(p.x,p.y-40,'Last Breath','#ff9a3a',true);
  G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:180,t:0,max:0.45,col:'#ff9a3a'});}
// Per-frame powers: cooldown timers, burning aura, fire trail, falling meteors.
function powerTick(dt){const p=G.p;if(p.dead)return;
  for(const k of ['counterCd','novaCd','lbCd','rageT','wrathT','beatT','pyreT'])if(p[k]>0)p[k]-=dt;
  if(G.inTown)return;
  if(hasPw('burnAura')){p.auraT=(p.auraT||0)-dt;if(p.auraT<=0){p.auraT=0.5;aoe(p.x,p.y,AURA_R,AURA_MULT,{splashed:true,quiet:true,dot:true,ignite:combo('Bonfire')});}}
  if(hasPw('fireTrail')){const L=p.trail||(p.trail={x:p.x,y:p.y});if(Math.hypot(p.x-L.x,p.y-L.y)>26){L.x=p.x;L.y=p.y;
    const tr=G.hazards.filter(h=>h.trail);if(tr.length>=14)G.hazards.splice(G.hazards.indexOf(tr[0]),1);
    G.hazards.push({sk:G.sk,x:p.x,y:p.y,r:36,t:2.5,tick:0.25,mult:TRAIL_MULT,trail:true,quiet:true});}}
  if(hasPw('coreFlare')){p.flareT=(p.flareT==null?5:p.flareT)-dt;if(p.flareT<=0){p.flareT=5;aoe(p.x,p.y,170,1.6,{splashed:true});
    G.fx.push({type:'ring',x:p.x,y:p.y,r0:16,r1:175,t:0,max:0.4,col:'#ff6a1a'});burst(p.x,p.y,36,'#ffb04a',260);G.hazards.push({sk:G.sk,x:p.x,y:p.y,r:120,t:2,tick:0.25,mult:0.2,quiet:true});}}
  if(hasPw('skyfall')){p.skyT=(p.skyT==null?3:p.skyT)-dt;if(p.skyT<=0){const e=nearest(p.x,p.y,420);if(e){meteorAt(e.x,e.y);p.skyT=8;}else p.skyT=0.5;}}
}
const AURA_R=115;
// Pyre: set an enemy on fire (renews; the strongest fire wins).
function ignite(e){const dps=pwHit(IGNITE_MULT)*(1-(e.dr||0));e.burnDps=e.burnT>0?Math.max(e.burnDps,dps):dps;e.burnT=IGNITE_T;}
// Cometwake: the end of a dodge (Wildfire with Ashwalker Treads: burning ground there).
function cometImpact(){const p=G.p;aoe(p.x,p.y,90,1.2,{splashed:true});burst(p.x,p.y,26,'#ff8a2a',240);
  G.fx.push({type:'ring',x:p.x,y:p.y,r0:8,r1:95,t:0,max:0.3,col:'#ffaa44'});G.shake=Math.max(G.shake,5);
  if(combo('Wildfire'))G.hazards.push({sk:G.sk,x:p.x,y:p.y,r:70,t:3,tick:0.25,mult:WILD_MULT,quiet:true});}
// Tempest: a critical hit takes 0.25 s off every skill cooldown (4 times per second at most).
function stormbeat(){const p=G.p;if(p.beatT>0)return;p.beatT=0.25;for(let i=1;i<5;i++)if(p.cd[i]>0)p.cd[i]=Math.max(0,p.cd[i]-0.25);}
// Cinderguard Vow: a Cleave leaves a patch of burning ground in front of you (at most 8 patches at once).
function cinderPatch(ang,reach){const p=G.p,x=p.x+Math.cos(ang)*reach*0.6,y=p.y+Math.sin(ang)*reach*0.6;
  const own=G.hazards.filter(h=>h.cinder);if(own.length>=8)G.hazards.splice(G.hazards.indexOf(own[0]),1);
  G.hazards.push({sk:G.sk,x,y,r:48,t:2.5,tick:0.25,mult:CINDER_MULT,cinder:true,quiet:true});}
// Frostbound Regalia: a frozen enemy that dies bursts into 8 piercing ice shards.
function iceShards(e){const n=8;for(let k=0;k<n;k++){const a=k/n*TAU;
  G.proj.push({x:e.x,y:e.y,vx:Math.cos(a)*460,vy:Math.sin(a)*460,r:6,col:'#bff0ff',life:0.5,from:'p',mult:0.6,pierce:1,hits:new Set([e])});}
  burst(e.x,e.y,16,'#dff6ff',200);}
