'use strict';
// Crafting currencies (v1.0.61, PoE2 style): small consumables that drop from monsters (more from champions and bosses,
// and more in harder content: maps.js DIFFS loot.cur) and change one item. They live in one pouch shared by every hero
// (CUR_KEY, part of the save backups). No craft limit: each use costs a drop. They work on white, magic and rare gear;
// uniques, set items, Runebinds and charms can't be changed by them. Every new stat rolls a tier for the item's level
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
  star:{name:'Star-Iron',ic:'★',col:'#ffb347',w:2,desc:'Raises one random stat by one tier (as far as the item level allows)'}
};
const CUR_KEYS=Object.keys(CURS);
let CUR={};
const CUR_NOW=()=>CUR; // (tests: CUR is a let)
function loadCur(){CUR={};try{const o=JSON.parse(localStorage.getItem(CUR_KEY));if(o&&typeof o==='object')for(const k of CUR_KEYS)if(o[k]>0)CUR[k]=Math.floor(o[k]);}catch(e){}}
function storeCur(){try{localStorage.setItem(CUR_KEY,JSON.stringify(CUR));}catch(e){}backupSoon();}
const curCount=k=>CUR[k]||0;
function curAdd(k,n=1){if(!CURS[k])return;CUR[k]=curCount(k)+n;storeCur();}
// ---------- what each one does ----------
const curEditable=it=>!!it&&it.slot!=='charm'&&it.rarity<=2&&!it.rb;
const tieredAffs=it=>it.affs.filter(a=>a.t&&tiered(a.k));
// The best tier a stat can reach on this item (item level gates T1-T3: items.js TIER_MIN_IL).
const bestTierFor=it=>{for(let t=1;t<=TIER_N;t++)if(it.ilvl>=TIER_MIN_IL[t])return t;return TIER_N;};
// Stats that can be added keeping the item's rarity (magic 1 + 1, rare 2 + 2), not already on it.
function curAddPool(it,rar=it.rarity){const have=new Set(it.affs.map(a=>a.k));
  return affPool(it).filter(k=>!have.has(k)&&(k!=='resist'||!RES_KEYS.every(x=>have.has(x)))&&affFits(it,k,rar));}
const newAff=(it,k)=>rollAff(k,affLvl(it.ilvl,it.tier),1,{il:it.ilvl});
// Why a currency can't be used on this item (null: it can).
function curBlock(k,it){if(!curEditable(it))return 'Only white, magic and rare gear';
  const n=statCount(it);
  if(k==='spark')return it.rarity===0?null:'Only white items';
  if(k==='crown')return it.rarity!==1?'Only magic items':curAddPool(it,2).length?null:'No stat can be added';
  if(k==='shard')return it.rarity<1?'Only magic and rare items':curAddPool(it).length?null:'No free prefix or suffix';
  if(k==='cinder')return it.rarity===2?null:'Only rare items';
  if(k==='tear')return it.rarity>=1&&tieredAffs(it).length?null:'Only magic and rare items';
  if(k==='ash')return it.rarity>=1&&n?null:'No stats to remove';
  if(k==='star')return it.rarity<1?'Only magic and rare items':tieredAffs(it).some(a=>a.t>bestTierFor(it))?null:'Every stat is already at its best tier';
  return 'Unknown';}
// Applies currency k to the item (pays one). Returns a short text of what happened, or null.
function useCur(k,it){if(curCount(k)<1||curBlock(k,it))return null;const l=affLvl(it.ilvl,it.tier);let msg='';
  if(k==='spark'){const keys=pickAffKeys(curAddPool(it,1),randi(1,2),1,1);it.affs=keys.map(x=>newAff(it,x));msg='Awakened: now magic';}
  else if(k==='crown'){it.affs.push(newAff(it,pick(curAddPool(it,2))));msg='Ascended: now rare';}
  else if(k==='shard'){const a=newAff(it,pick(curAddPool(it)));it.affs.push(a);msg='Added '+affText(a,1,it.cls)+(a.t?` (T${a.t})`:'');}
  else if(k==='cinder'){it.affs=pickAffKeys(affPool(it),randi(3,4),MAX_PRE,MAX_SUF).map(x=>newAff(it,x)).concat(Math.random()<0.3?[{k:'skill',s:randi(0,4),v:1}]:[]);msg='Every stat rerolled';}
  else if(k==='tear'){for(const a of tieredAffs(it))a.v=tierVal(a.k,l,a.t);msg='Values rerolled, tiers kept';}
  else if(k==='ash'){const st=it.affs.filter(a=>a.k!=='skill'),a=pick(st);it.affs.splice(it.affs.indexOf(a),1);msg='Removed '+affText(a,1,it.cls);}
  else if(k==='star'){const best=bestTierFor(it),a=pick(tieredAffs(it).filter(x=>x.t>best));a.t--;a.v=tierVal(a.k,l,a.t);msg=`${affText(a,1,it.cls)} rose to T${a.t}`;}
  delete it.addOpts;restat(it);CUR[k]--;if(!CUR[k])delete CUR[k];storeCur();
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
const curAny=it=>curEditable(it)&&CUR_KEYS.some(k=>curCount(k)>0);
tap('curClose',closeCurrency);
tap('curBtn',()=>openCurrency(null));
