'use strict';
// Subclasses ("paths"): at level SUB_LVL each hero picks one of their class's two paths, for good (c.sub, saved).
// A path has four fixed perks that switch on at their level (SUB_PERK_LVLS). Picked on the skill screen's Path tab,
// with a confirmation (it can't be undone). Perks are checked with hasPerk(key); their effects live where the
// system they change does (marked "subclasses.js" there). live:false = listed but not working yet ("coming soon").
// Classes differ in power on purpose, and so do paths: they are not tuned to be equal.
const SUB_LVL=20,SUB_PERK_LVLS=[20,28,36,44];
const hasPaths=c=>!!(c&&(SUBCLASSES[c.cls]||[]).length); // v1.0.124: a class without paths yet is never asked to choose
const SUBCLASSES={
  warden:[
    {k:'bulwark',name:'Bulwark',icon:'🛡️',col:'#9ab0ff',t:'Shield and stone: blocks that heal and stun, more armour, hard to kill.',
     perks:[{k:'blockHeal',t:'Blocking an attack heals 2% of your Life'},{k:'blockStun',t:'A block stuns the attacker for 1s (bosses briefly)'},
       {k:'ironHide',t:'+30% Armor and +30% thorns damage'},{k:'lastStand',t:'Below 30% Life you take 30% less damage'}]},
    {k:'reaver',name:'Reaver',icon:'🩸',col:'#e04040',t:'Two-handers, bleeding and crits: hits that keep hurting.',
     perks:[{k:'deepCuts',t:'Your bleeds deal 50% more damage'},{k:'heavyCrit',t:'+10% crit chance with a two-handed weapon'},
       {k:'killRush',t:'Each kill gives +4% attack speed for 4s, stacking up to 5 times'},{k:'bloodScent',t:'Bleeding enemies take 15% more damage from you'}]}
  ],
  arcanist:[
    {k:'stormcaller',name:'Stormcaller',icon:'🌩️',col:'#ffe24a',t:'Lightning and frost: deeper Shocks, faster Freezes.',
     perks:[{k:'highVoltage',t:'Shock stacks up to 5 times instead of 3'},{k:'quickFreeze',t:'3 cold hits Freeze instead of 4'},
       {k:'stormReach',t:'Chain Lightning bounces 2 more times and Frost Nova recharges 25% faster'},{k:'stormSiphon',t:'Hitting a Shocked enemy restores 1 Mana'}]},
    {k:'pyreborn',name:'Pyreborn',icon:'🔥',col:'#ff8a2a',t:'Fire and poison: everything burns, burns longer and bursts.',
     perks:[{k:'kindling',t:'+15% chance to Ignite on every hit'},{k:'longBurn',t:'Your burning ground lasts 50% longer'},
       {k:'venomBlood',t:'Your poison deals 30% more damage'},{k:'pyreBurst',t:'Enemies that die while burning explode for 30% of their Life to enemies nearby'}]}
  ],
  ranger:[ // v1.0.131
    {k:'beastmaster',name:'Beastmaster',icon:'🐺',col:'#c8a070',t:'Wolf and hawk: stronger, tougher companions that hunt beside you.',
     perks:[{k:'packLeader',t:'Your wolf and hawk deal 40% more damage'},{k:'thickHide',t:'Your wolf has 60% more Life and heals three times as fast'},
       {k:'wildCall',t:'Call of the Wild and Hawk cost no Focus and recharge 30% faster'},{k:'alphaRoar',t:'When your wolf or hawk kills an enemy, you heal 5% of your Life'}]},
    {k:'sharpshooter',name:'Sharpshooter',icon:'🎯',col:'#9fd8a0',t:'Arrows and precision: crits, piercing and long shots.',
     perks:[{k:'eagleEye',t:'+10% crit chance'},{k:'longShot',t:'Arrows deal up to 30% more damage the farther they fly (full at 400 paces)'},
       {k:'pinpoint',t:'Your arrows pierce 1 more enemy'},{k:'headshot',t:'Every 6th arrow that hits is a Headshot: triple damage'}]}
  ]
};
for(const cls in SUBCLASSES)for(const S of SUBCLASSES[cls])S.perks.forEach((P,i)=>{P.lvl=SUB_PERK_LVLS[i];if(P.live==null)P.live=true;});
function subOf(c){c=c||G.char;return c&&c.sub?(SUBCLASSES[c.cls]||[]).find(S=>S.k===c.sub)||null:null;}
// the hero's title: their path's name once chosen, else the class name (HUD, hero list, victory screen)
function titleOf(c){const S=subOf(c);return S?S.name:CLASSES[c.cls].name;}
// is perk k on for the current hero (their path has it and they are at its level)
function perkOn(c,k){const S=subOf(c);if(!S)return false;const P=S.perks.find(P=>P.k===k);return !!(P&&c.lvl>=P.lvl);}
function hasPerk(k){return perkOn(G.char,k);}
// keeps c.sub valid (a path of the hero's own class, or null)
function fixSub(c){if(!(SUBCLASSES[c.cls]||[]).some(S=>S.k===c.sub))c.sub=null;return c.sub;}
// choosing: the first tap asks, the second (pickSub(k,true)) makes it permanent
let subAsk=null;
function pickSub(k,sure){const c=G.char;if(!c||c.sub||c.lvl<SUB_LVL)return false;const S=(SUBCLASSES[c.cls]||[]).find(S=>S.k===k);if(!S)return false;
  if(!sure){subAsk=k;return false;}
  c.sub=k;subAsk=null;saveChar();playSfx('levelup');buzz('levelup');toast(`You are a ${S.name}`,S.t);return true;}
// the Path tab of the skill screen
function pathHtml(c){const L=SUBCLASSES[c.cls]||[],mine=subOf(c);
  const perkRows=S=>S.perks.map(P=>{const on=mine===S&&c.lvl>=P.lvl;return `<div class="perk${on?' on':''}"><b>Lv ${P.lvl}</b> ${P.t}${P.live===false?' <i>(coming soon)</i>':''}</div>`;}).join('');
  const head=mine?`<div class="sub">You are a <b style="color:${mine.col}">${mine.icon} ${mine.name}</b>. Your path is chosen for good.</div>`
    :c.lvl<SUB_LVL?`<div class="sub">At level ${SUB_LVL} you choose one of these paths <b>for good</b>. You are level ${c.lvl}.</div>`
    :`<div class="sub">Choose your path. <b>This can't be changed later.</b></div>`;
  return head+`<div class="cols2">${L.map(S=>{const ask=subAsk===S.k&&!mine;
    const btn=mine?'':c.lvl<SUB_LVL?`<div class="btn sm dis">Level ${SUB_LVL}</div>`:ask?`<div class="pathask">Become a ${S.name} for good?<div class="btn sm" data-sure="${S.k}">Yes, choose ${S.name}</div><div class="btn sm" data-no="1">Not yet</div></div>`:`<div class="btn sm" data-sub="${S.k}">Choose ${S.name}</div>`;
    return `<div class="pathcard${mine===S?' mine':''}${mine&&mine!==S?' other':''}" style="border-color:${S.col}"><div class="pn" style="color:${S.col}">${S.icon} ${S.name}</div><div class="pt">${S.t}</div>${perkRows(S)}${btn}</div>`;}).join('')}</div>`;}

// ---------- perk effects ----------
// Hooks: game.js dmgPlayer (Block Heal, Block Stun, Last Stand), items.js calcStats (Iron Hide, Heavy Crit: perkStats),
// game.js hitEnemy (Deep Cuts: bleedMul, Blood Scent), game.js killEnemy (Kill Rush), skills.js skillCd (Kill Rush).
function perkStats(c,s,eq){if(perkOn(c,'ironHide')){s.armor*=1.3;s.thorns*=1.3;}if(perkOn(c,'heavyCrit')&&is2h(eq.mainhand))s.crit+=10;
  if(perkOn(c,'kindling'))s.igniteCh=Math.min(AIL_CH_CAP,s.igniteCh+15);
  if(perkOn(c,'eagleEye'))s.crit+=10;if(perkOn(c,'pinpoint'))s.pierce=(s.pierce||0)+1;} // v1.0.131: Sharpshooter
function perkTakenMul(){const p=G.p;return hasPerk('lastStand')&&p.hp<G.stats.life*0.3?0.7:1;}
function perkBlock(src){const p=G.p;if(hasPerk('blockHeal'))healPlayer(G.stats.life*0.02,true);
  if(hasPerk('blockStun')&&src&&!src.dead&&src.hp!=null&&!(src.stunCd>0)){src.stun=Math.max(src.stun||0,src.type==='boss'?0.3:1);src.stunCd=1.5;floatText(src.x,src.y-src.r-20,'Stun','#ffd54a',false);}}
const bleedMul=()=>hasPerk('deepCuts')?1.5:1;
function perkHitMul(e){return e.bleedT>0&&hasPerk('bloodScent')?1.15:1;}
function perkKill(){if(!hasPerk('killRush'))return;const p=G.p;p.rushN=Math.min(5,(p.rushT>0?p.rushN||0:0)+1);p.rushT=4;}
function perkTick(p,dt){if(p.rushT>0){p.rushT-=dt;if(p.rushT<=0)p.rushN=0;}}
const rushMul=()=>{const p=G.p;return p&&p.rushT>0?1+0.04*(p.rushN||0):1;};
// Arcanist. Hooks: ailments.js (High Voltage: shockMax, Quick Freeze: freezeAt, Venom Blood: poisonMul), skills.js
// (Storm Reach: Chain Lightning bounces, Frost Nova cooldown), game.js (Storm Siphon in hitEnemy, Long Burn in the
// burning ground timer, Pyre Burst in killEnemy), perkStats (Kindling).
const shockMax=()=>hasPerk('highVoltage')?5:SHOCK_MAX,freezeAt=()=>hasPerk('quickFreeze')?3:CHILL_FREEZE,poisonMul=()=>hasPerk('venomBlood')?1.3:1;
const burnTimeMul=()=>hasPerk('longBurn')?1/1.5:1; // your burning ground runs down this much slower
function perkHitAfter(e,opts){if(e.shockT>0&&!opts.dot&&!opts.haz&&hasPerk('stormSiphon'))gainRes(1);}
// Pyre Burst: an enemy that dies burning explodes for 30% of its Life (half to bosses); burning ones it kills explode too
function pyreBurst(e){if(!(e.burnT>0)||!hasPerk('pyreBurst'))return;const R=90,dmg=e.maxHp*0.3;fxExplosion(e.x,e.y,R);
  for(const o of G.enemies){if(o===e||o.dead||o.hidden||Math.hypot(o.x-e.x,o.y-e.y)>R+o.r)continue;const d=Math.max(1,Math.round(dmg*(o.type==='boss'?0.5:1)*(1-(o.dr||0))));
    o.hp-=d;o.flash=0.1;floatText(o.x+rand(-8,8),o.y-o.r-6,d,'#ff9a4a',false);if(o.type==='boss')bossGate(o);if(o.hp<=0&&!o.dead)killEnemy(o);}}
// Ranger (v1.0.131). Hooks: ranger.js (Pack Leader: petMul, Thick Hide in callWolf/petTick, Alpha Roar: petKill),
// skills.js skillCd + skillmods.js modCost (Wild Call), game.js projectiles (Long Shot, Headshot: arrowMul), perkStats.
const petMul=()=>(hasPerk('packLeader')?1.4:1)*(1+(G.stats&&G.stats.petdmg||0)/100)*(hasPw('wildHunt')?1.6:1); // passives.js: Hunting Pack; uniques.js: Wild Hunt set
function petKill(e){if(e.dead&&hasPerk('alphaRoar'))healPlayer(G.stats.life*0.05,true);}
// an arrow q hitting: Long Shot by how far it flew, Headshot on every 6th arrow hit
function arrowMul(q,e){if(!q.arrow)return 1;let m=1;if(hasPw('heartseek')&&e.hp>e.maxHp*0.9)m*=1.4; /* uniques.js: Heartseeker */
  if(hasPerk('longShot')&&q.sx!=null)m*=1+0.3*Math.min(1,Math.hypot(q.x-q.sx,q.y-q.sy)/400);
  if(hasPerk('headshot')){const p=G.p;p.hsN=(p.hsN||0)+1;if(p.hsN>=6){p.hsN=0;m*=3;floatText(e.x,e.y-e.r-26,'Headshot!','#ffd36b',true);}}
  return m;}
