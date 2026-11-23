'use strict';
// Crafting currencies (v1.0.61, PoE2 style): small consumables that drop from monsters (more from champions and bosses,
// and more in harder content: maps.js DIFFS loot.cur) and change one item. They live in one pouch shared by every hero
// (CUR_KEY, part of the save backups). No craft limit: each use costs a drop. They work on white, magic and rare gear;
// uniques, set items, Runebinds and unique charms can't be changed by them. Charms (v1.0.62): Shard, Cinder, Tear,
// Void Ash and Star-Iron work on them, up to the size's most stats (charms.js CHARM max); a charm keeps at least one stat. Every new stat rolls a tier for the item's level
// (items.js affix tiers) and must fit an open prefix or suffix slot. The Blacksmith's crafts stay as they were.
// Use: an item card's ✦ Craft button (pick a currency), or look through the pouch from the inventory (✦ Currency).
const CUR_KEY='emberdeep_currency';
// w: drop weight (Star-Iron is the rare one) · use: which items it works on.
const CURS={
  spark:{name:'Spark of Awakening',ic:'✦',col:'#9ab0ff',w:30,desc:'A white item becomes magic, with 1–2 random stats'},
  crown:{name:'Crown of Ascension',ic:'♛',col:'#f2d04a',w:13,desc:'A magic item becomes rare, gaining one random stat'},
  shard:{name:'Shard of Accretion',ic:'◆',col:'#c8e0ff',w:9,desc:'Adds one random stat to a magic or rare item with a free prefix or suffix'},
  cinder:{name:'Cinder of Unmaking',ic:'✹',col:'#ff8a4a',w:12,desc:'Rerolls every stat of a rare item'},
  tear:{name:'Tear of Fate',ic:'💧',col:'#7fe0ff',w:9,desc:'Rerolls the values of every stat, keeping their tiers'},
  ash:{name:'Void Ash',ic:'◌',col:'#a090c8',w:8,desc:'Removes one random stat'},
  star:{name:'Star-Iron',ic:'★',col:'#ffb347',w:2,desc:'Raises one random stat by one tier (as far as the item level allows)'},
  // v1.0.63: sockets and quality
  awl:{name:"Delver's Awl",ic:'⊙',col:'#d8c8a8',w:4,desc:'Adds one socket (up to the most the item can hold)'},
  spindle:{name:'Socket Spindle',ic:'◎',col:'#b8a888',w:3,desc:'Rerolls the number of sockets (empty sockets only)'},
  whet:{name:'Whetstone',ic:'▰',col:'#c8d0d8',w:6,desc:'+5% quality: more base damage or armor, up to 20% (Superior counts as 15%)'},
  // catalysts: put one on an item; the next Spark, Crown, Shard or Cinder on it uses it up
  precision:{name:'Catalyst of Precision',ic:'❖',col:'#ffd27a',w:1.5,cat:1,desc:'Next craft: new stats roll only T1–T3'},
  flame:{name:'Catalyst of Flame',ic:'♨',col:'#ff9a3a',w:1.5,cat:['fres'],desc:'Next craft: one new stat is Fire Resistance'},
  frost:{name:'Catalyst of Frost',ic:'❄',col:'#9fd8ff',w:1.5,cat:['cres'],desc:'Next craft: one new stat is Cold Resistance'},
  storm:{name:'Catalyst of Storms',ic:'ϟ',col:'#ffe45a',w:1.5,cat:['lres'],desc:'Next craft: one new stat is Lightning Resistance'},
  venom:{name:'Catalyst of Venom',ic:'☣',col:'#9fe04a',w:1.5,cat:['pres'],desc:'Next craft: one new stat is Poison Resistance'},
  bulwark:{name:'Catalyst of the Bulwark',ic:'⛨',col:'#c8b088',w:2,cat:['life','armor','block'],desc:'Next craft: one new stat is a defence (Life, Armor or Block)'},
  haste:{name:'Catalyst of Haste',ic:'➶',col:'#a8e0c0',w:2,cat:['aspd','move','cdr'],desc:'Next craft: one new stat is a speed (Attack, Move or Cooldown)'},
  fury:{name:'Catalyst of Fury',ic:'⚔',col:'#ff6a5a',w:2,cat:['dmg','crit','critd'],desc:'Next craft: one new stat is an attack stat (Damage, Crit, Crit Damage)'},
  arcana:{name:'Catalyst of Arcana',ic:'✧',col:'#c8a0ff',w:1.5,cat:['spell'],desc:'Next craft: one new stat is Spell Damage (Arcanist gear)'}
};
const CRAFTS_ADD=new Set(['spark','crown','shard','cinder']); // the crafts a catalyst works on
const CUR_KEYS=Object.keys(CURS);
let CUR={};
const CUR_NOW=()=>CUR; // (tests: CUR is a let)
function loadCur(){CUR={};try{const o=JSON.parse(localStorage.getItem(CUR_KEY));if(o&&typeof o==='object')for(const k of CUR_KEYS)if(o[k]>0)CUR[k]=Math.floor(o[k]);}catch(e){}}
function storeCur(){try{localStorage.setItem(CUR_KEY,JSON.stringify(CUR));}catch(e){}backupSoon();}
const curCount=k=>CUR[k]||0;
function curAdd(k,n=1){if(!CURS[k])return;CUR[k]=curCount(k)+n;storeCur();}
// ---------- what each one does ----------
const curEditable=it=>!!it&&it.rarity<=2&&!it.rb&&!it.uc;
const isCharm=it=>it.slot==='charm';
// A charm's stat count (its grand skill not counted) and the room it has.
const charmStats=it=>it.affs.filter(a=>a.k!=='skill').length;
const tieredAffs=it=>it.affs.filter(a=>a.t&&tiered(a.k));
// The best tier a stat can reach on this item (item level gates T1-T3: items.js TIER_MIN_IL).
const bestTierFor=it=>{for(let t=1;t<=TIER_N;t++)if(it.ilvl>=TIER_MIN_IL[t])return t;return TIER_N;};
// Stats that can be added keeping the item's rarity (magic 1 + 1, rare 2 + 2), not already on it.
function curAddPool(it,rar=it.rarity){const have=new Set(it.affs.map(a=>a.k)),fresh=k=>!have.has(k)&&(k!=='resist'||!RES_KEYS.every(x=>have.has(x)));
  if(isCharm(it))return charmStats(it)<CHARM[it.size].max?charmPool(it,it.cls).filter(fresh):[];
  return affPool(it).filter(k=>fresh(k)&&affFits(it,k,rar));}
// The catalyst on the item: tiers T1-T3 (precision) and/or a stat group one new stat must come from.
const catT=it=>it.cat==='precision'?{il:it.ilvl,worst:3}:{il:it.ilvl};
const newAff=(it,k)=>isCharm(it)?(it.cat==='precision'?rollAff(k,it.ilvl,charmRm(it,k),{il:it.ilvl,worst:3}):charmAff(it,k)):rollAff(k,affLvl(it.ilvl,it.tier),1,catT(it));
// A stat from the catalyst's group that can go on the item ('resist' in a pool allows each element), or null.
function catPick(it,pool){const C=it.cat&&CURS[it.cat],g=C&&Array.isArray(C.cat)?C.cat:null;if(!g)return null;
  const ok=g.filter(k=>pool.includes(k)||RES_KEYS.includes(k)&&pool.includes('resist'));return ok.length?pick(ok):null;}
// n keys from the pool (prefix/suffix limits p/q), the catalyst's stat first when it has one.
function keysWithCat(it,pool,n,p,q){const f=catPick(it,pool);if(!f)return isCharm(it)?pool.slice().sort(()=>Math.random()-0.5).slice(0,n):pickAffKeys(pool,n,p,q);
  const rest=pool.filter(k=>k!==f&&!(RES_KEYS.includes(f)&&k==='resist'));
  return [f].concat(isCharm(it)?rest.sort(()=>Math.random()-0.5).slice(0,n-1):pickAffKeys(rest,n-1,p-(isPre(f)?1:0),q-(isPre(f)?0:1)));}
// A tier's value for stat a on this item (charms: their own level and size multiplier).
const reTier=(it,a)=>isCharm(it)?tierVal(a.k,it.ilvl,a.t,charmRm(it,a.k)):tierVal(a.k,affLvl(it.ilvl,it.tier),a.t);
// Why a currency can't be used on this item (null: it can).
const QMAX=20,qualMax=it=>QMAX-(it.sup?15:0);
// Sockets and quality also work on uniques and set items (not Runebinds or charms).
function curBlockBase(k,it){if(!it||it.slot==='charm'||it.rb)return 'Not on charms or Runebinds';
  if(k==='whet')return !(it.slot==='weapon'||it.arm)?'Has no base damage or armor':(it.q||0)>=qualMax(it)?'Already at 20% quality':null;
  const mx=maxSockets(it);if(!mx)return 'This item type cannot hold sockets';
  if(k==='awl')return (it.sockets||0)<mx?null:`Already has ${mx} sockets`;
  if(k==='spindle')return it.socketed&&it.socketed.length?'Unsocket its stones first':mx>1||!it.sockets?null:'Holds only one socket';}
function curBlock(k,it){if(k==='awl'||k==='spindle'||k==='whet')return curBlockBase(k,it);
  if(!curEditable(it))return 'Only white, magic and rare gear and charms';
  if(CURS[k]&&CURS[k].cat)return it.cat===k?'Already on this item':null;
  const n=statCount(it);
  if(isCharm(it)){if(k==='spark'||k==='crown')return 'Not on charms';if(k==='shard')return curAddPool(it).length?null:`Holds at most ${CHARM[it.size].max} stat${CHARM[it.size].max>1?'s':''}`;
    if(k==='cinder')return null;if(k==='ash')return charmStats(it)>=2?null:'A charm keeps at least one stat';}
  if(k==='spark')return it.rarity===0?null:'Only white items';
  if(k==='crown')return it.rarity!==1?'Only magic items':curAddPool(it,2).length?null:'No stat can be added';
  if(k==='shard')return it.rarity<1?'Only magic and rare items':curAddPool(it).length?null:'No free prefix or suffix';
  if(k==='cinder')return it.rarity===2?null:'Only rare items';
  if(k==='tear')return it.rarity>=1&&tieredAffs(it).length?null:'Only magic and rare items';
  if(k==='ash')return it.rarity>=1&&n?null:'No stats to remove';
  if(k==='star')return it.rarity<1?'Only magic and rare items':tieredAffs(it).some(a=>a.t>bestTierFor(it))?null:'Every stat is already at its best tier';
  return 'Unknown';}
// Applies currency k to the item (pays one). Returns a short text of what happened, or null.
function useCur(k,it){if(curCount(k)<1||curBlock(k,it))return null;let msg='';const cat=it.cat;
  if(CURS[k].cat){it.cat=k;CUR[k]--;if(!CUR[k])delete CUR[k];storeCur();playSfx('rune');return 'Ready: the next Spark, Crown, Shard or Cinder on this item uses it';}
  if(k==='awl'){it.sockets=(it.sockets||0)+1;msg=`Now ${it.sockets} socket${it.sockets>1?'s':''}`;}
  else if(k==='spindle'){const mx=maxSockets(it),was=it.sockets||0;let n=randi(1,mx);if(mx>1)while(n===was)n=randi(1,mx);it.sockets=n;msg=`Now ${n} socket${n>1?'s':''}`;}
  else if(k==='whet'){it.q=Math.min(qualMax(it),(it.q||0)+5);msg=`Quality ${it.q+(it.sup?15:0)}%`;}
  else if(k==='spark'){const keys=keysWithCat(it,curAddPool(it,1),randi(1,2),1,1);it.affs=keys.map(x=>newAff(it,x));msg='Awakened: now magic';}
  else if(k==='crown'){const P=curAddPool(it,2);it.affs.push(newAff(it,catPick(it,P)||pick(P)));msg='Ascended: now rare';}
  else if(k==='shard'){const P=curAddPool(it),a=newAff(it,catPick(it,P)||pick(P));it.affs.push(a);msg='Added '+affText(a,1,it.cls)+(a.t?` (T${a.t})`:'');}
  else if(k==='cinder'){if(isCharm(it)){const C=CHARM[it.size],sk=it.affs.filter(a=>a.k==='skill');it.affs=sk.concat(keysWithCat(it,charmPool(it,it.cls),randi(C.n[0],C.n[1]),9,9).map(x=>newAff(it,x)));}
    else it.affs=keysWithCat(it,affPool(it),randi(3,4),MAX_PRE,MAX_SUF).map(x=>newAff(it,x)).concat(Math.random()<0.3?[{k:'skill',s:randi(0,4),v:1}]:[]);msg='Every stat rerolled';}
  else if(k==='tear'){for(const a of tieredAffs(it))a.v=reTier(it,a);msg='Values rerolled, tiers kept';}
  else if(k==='ash'){const st=it.affs.filter(a=>a.k!=='skill'),a=pick(st);it.affs.splice(it.affs.indexOf(a),1);msg='Removed '+affText(a,1,it.cls);}
  else if(k==='star'){const best=bestTierFor(it),a=pick(tieredAffs(it).filter(x=>x.t>best));a.t--;a.v=reTier(it,a);msg=`${affText(a,1,it.cls)} rose to T${a.t}`;}
  if(CRAFTS_ADD.has(k)&&cat){delete it.cat;msg+=` · ${CURS[cat].name} used`;} // a catalyst lasts one craft
  if(k!=='awl'&&k!=='spindle'&&k!=='whet'){delete it.addOpts;if(isCharm(it))it.name=charmName(it);else restat(it);}CUR[k]--;if(!CUR[k])delete CUR[k];storeCur();
  playSfx(k==='star'?'unique':'rune');return msg;}
// ---------- drops ----------
// Chance per kill (normal, champion pack member, champion, zone boss, act boss: those always drop some), x DIFFS loot.cur.
const CUR_DROP={normal:0.03,elite:0.12,su:0.6,zboss:1.5,boss:2.5,chest:0.8};
function rollCurKey(){const d=PD(),w=k=>CURS[k].w*(k==='star'?1+d/40:1);let r=Math.random()*CUR_KEYS.reduce((a,k)=>a+w(k),0);
  for(const k of CUR_KEYS){r-=w(k);if(r<0)return k;}return 'spark';}
function dropCurrency(e,kind){let n=(CUR_DROP[kind]||0)*lootHere().cur;
  for(;n>0;n--)if(n>=1||Math.random()<n){let x=e.x+rand(-30,30),y=e.y+rand(-30,30);if(blockedAt(x,y,4)){x=G.p.x;y=G.p.y;}const l={x,y,cur:rollCurKey(),t:0};G.loot.push(l);if(l.cur==='star')playSfx('rune');}}
function pickCur(l){l.taken=true;curAdd(l.cur);const C=CURS[l.cur];floatText(l.x,l.y-20,C.name,C.col,false);playSfx('pickup');}
function drawCurLoot(l,bob){const C=CURS[l.cur],x=l.x,y=l.y+bob;softShadow(x,y+8,8,3,0.8);
  ctx.fillStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.arc(x,y,9,0,TAU);ctx.fill();ctx.strokeStyle=C.col;ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle=C.col;ctx.font='12px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(C.ic,x,y+0.5);ctx.textBaseline='alphabetic';
  lootLabel(x,y-16,C.name,C.col,C.col,null,null,true);}
// ---------- the pouch window ----------
let curFor=null; // {it, equipped}: crafting this item; null: just looking
function openCurrency(it,equipped){curFor=it?{it,equipped}:null;renderCurrency();$('curOv').classList.remove('hidden');if(!it)setPause();}
function closeCurrency(){$('curOv').classList.add('hidden');const f=curFor;curFor=null;if(f)openItem(f.it,f.equipped);else setPause();}
function renderCurrency(){const it=curFor&&curFor.it;
  $('curSub').innerHTML=it?`Crafting <b style="color:${RCOL[it.rarity]}">${esc(it.name)}</b>: tap a currency to use one.`:'Currency drops from monsters and is shared by all your heroes. Use it from an item card (✦ Craft).';
  $('curList').innerHTML=CUR_KEYS.map(k=>{const C=CURS[k],n=curCount(k),why=it?(n<1?'None left':curBlock(k,it)):null;
    return `<div class="slot${it&&!why?' cur-ok':''}${it&&why?' unk':''}" data-cur="${k}"><div class="ic" style="color:${C.col}">${C.ic}</div><div class="info"><b style="color:${C.col}">${C.name}</b> <span class="fdim">×${n}</span><div>${esc(C.desc)}</div>${why&&n>0?`<div class="fdim">${esc(why)}</div>`:''}</div></div>`;}).join('');
  if(it)$('curList').querySelectorAll('[data-cur]').forEach(el=>el.onclick=()=>{const k=el.dataset.cur,msg=useCur(k,it);if(!msg)return;toast(CURS[k].name,msg);refreshStats();renderInv();saveChar();renderCurrency();});}
const curAny=it=>CUR_KEYS.some(k=>curCount(k)>0&&!curBlock(k,it));
tap('curClose',closeCurrency);
tap('curBtn',()=>openCurrency(null));
