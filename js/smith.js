'use strict';
// Blacksmith (town): crafting with gold plus materials that salvaging now yields.
//   Reforge      a rare: reroll all of its stats
//   Enchant      a magic, rare or unique item: reroll one chosen stat into a different one
//   Quality      a white or blue item with base damage or armor: make it Superior (+15% base stats, once)
//   Add Socket   an item with no sockets (that can hold them): give it one. Expensive.
//   Upgrade Base a white item (sockets and Superior kept): same archetype, one tier higher, up to Tier V.
//                A unique can do this once, at a much higher price.
//   Add Stat     a white, magic or rare item with under 4 stats: roll 3 new stats and pick one to add
//   Remove Stat  a white, magic or rare item: take off the chosen stat
// Stat crafts (Add, Remove, Enchant, Reforge) on white, magic and rare items are limited: twice the item's
// base tier (Tier III = 6 crafts), rings and amulets by their act. Upgrade a white base first for more crafts.
// The stat count sets the rarity: 0 white, 1-2 magic, 3-4 rare.
// Charms and Runebinds can't be smithed.
// Salvage materials, one per rarity: white → Iron Scrap, magic → Arcane Dust, rare → Rare Essence,
// unique and Runebind → Primal Shard. Items from later acts give more.
const MATS={scrap:{name:'Iron Scrap',ic:'🔩',from:'white items',use:'Quality, Add Socket, Upgrade Base'},dust:{name:'Arcane Dust',ic:'✨',from:'blue items and charms',use:'Enchant, Reforge, Add Socket, Upgrade Base'},
  essence:{name:'Rare Essence',ic:'💠',from:'yellow items and grand charms',use:'Reforge, Enchant a rare, Add Socket, Upgrade Base'},primal:{name:'Primal Shard',ic:'🔶',from:'uniques, set items and Runebinds',use:'Enchant a unique, Upgrade Base to Tier IV–V'}};
const MAT_KEYS=Object.keys(MATS);
// Old saves had essence (magic tier) and shard (rare tier); the shard key marks that format.
const matsOf=c=>{const m=c.mats&&typeof c.mats==='object'?c.mats:(c.mats={});
  if('shard' in m){const e=m.essence,sh=m.shard;delete m.shard;m.dust=(+m.dust||0)+(+e||0);m.essence=+sh||0;}
  for(const k of MAT_KEYS)if(!(m[k]>=0))m[k]=0;return m;};
const matText=m=>MAT_KEYS.filter(k=>m[k]).map(k=>`${m[k]}${MATS[k].ic}`).join(' ');
// v1.0.50: about 40% as many items drop as before, so white, blue and yellow items give 2.5x the materials (5 instead of 2),
// keeping the materials per act (and so the smith's costs) where they were.
const RARITY_MAT=['scrap','dust','essence','primal','primal','primal'],RARITY_MAT_N=[5,5,5,1,1,1];
// Act the item comes from (1..5, endless items count as act 5), and the yield multiplier: x1 in Act 1 up to x3 in Act 5.
const itemAct=it=>clamp(Math.floor(((it.ilvl||1)-1)/5)+1,1,5);
const salvageMul=it=>1+0.5*(itemAct(it)-1);
// What salvaging an item gives besides gold (charms give dust, grand charms also essence). Fixed, so previews are exact.
function salvageMats(it){const mul=salvageMul(it);
  if(it.slot==='charm')return it.size==='grand'?{dust:Math.round(2*mul),essence:Math.round(mul)}:{dust:Math.round(mul)};
  const k=RARITY_MAT[it.rarity];return k?{[k]:Math.round(RARITY_MAT_N[it.rarity]*mul)}:{};}
// Auto-salvage on pickup (loot filter option): plain white items only; socketed whites are Runebind bases and are kept.
const autoSalvages=(c,it)=>!!(c.filter&&c.filter.autoSalv)&&it.rarity===0&&it.slot!=='charm'&&!it.sockets&&!it.lock;
function autoSalvage(c,it){const gold=salvageValue(it);c.gold+=gold;return {gold,mats:grantSalvage(c,it)};}
function grantSalvage(c,it){const g=salvageMats(it),m=matsOf(c);for(const k in g)m[k]+=g[k];return g;}
function addMats(a,b){for(const k in b)a[k]=(a[k]||0)+b[k];return a;}

// ---------- operations ----------
// Material costs grow with the item's act by the same multiplier as salvage yields, so crafting on
// Act 5 gear costs Act 5 materials. Sized from a full clear of one act (5 depths), salvaging about
// half of the drops: that pays for roughly 4 Qualities, 5 blue Enchants, 3 Reforges and 1-2 Add Sockets.
const matCost=(it,m)=>{const mul=salvageMul(it),o={};for(const k in m)o[k]=Math.round(m[k]*mul);return o;};
// v1.0.51: gold prices lowered about 25-30% (materials unchanged: salvage yields were raised with the drop change).
const SMITH_OPS={
  reforge:{name:'Reforge',desc:'Reroll every stat of a rare',cost:it=>({gold:30+it.ilvl*9,...matCost(it,{essence:4,dust:4})})},
  enchant:{name:'Enchant',desc:'Reroll the chosen stat into a different one',cost:it=>({gold:20+it.ilvl*6,...matCost(it,{dust:5,...(it.rarity===3||it.rarity===5?{primal:1}:it.rarity===2?{essence:2}:{})})})},
  quality:{name:'Quality',desc:'Superior: +15% base damage or armor',cost:it=>({gold:15+it.ilvl*4,...matCost(it,{scrap:8})})},
  socket:{name:'Add Socket',desc:'Give an item without sockets one socket',cost:it=>({gold:100+it.ilvl*20,...matCost(it,{scrap:10,dust:10,essence:5})})},
  add:{name:'Add Stat',desc:it=>it.addOpts&&it.addOpts.length?'Pick the stat you rolled (already paid)':'Roll 3 new stats, pick one to add',cost:it=>it.addOpts&&it.addOpts.length?{gold:0}:({gold:20+it.ilvl*7,...matCost(it,{dust:4,...(statCount(it)>=2?{essence:3}:{})})})},
  remove:{name:'Remove Stat',desc:'Take off the chosen stat',cost:it=>({gold:15+it.ilvl*4,...matCost(it,{scrap:4,dust:3})})},
  upbase:{name:'Upgrade Base',desc:it=>it.tier>=1&&it.tier<5?`Same ${baseKindName(it)}, Tier ${TIER_NAME[it.tier-1]} → ${TIER_NAME[it.tier]}: stronger base stats`:'Raise the base one tier',cost:it=>upbaseCost(it)}
};
// ---------- stat crafts ----------
const MAX_STATS=4,ADD_OPTS=3,CRAFT_OPS=new Set(['add','remove','enchant','reforge']);
const craftLimited=it=>it.rarity>=0&&it.rarity<=2&&it.slot!=='charm';
const craftMax=it=>2*(it.tier||itemAct(it));
const craftsLeft=it=>Math.max(0,craftMax(it)-(it.crafts||0));
const statCount=it=>it.affs.filter(a=>a.k!=='skill').length;
// Rarity and name follow the stats: 0 white, 1-2 magic (prefix/suffix name), 3+ rare (a rare keeps its name).
function restat(it){const was=it.rarity,n=it.affs.length;it.rarity=n>=3?2:n?1:0;
  const plain=String(it.base||'').replace(/^Superior /,''),sup=it.sup?'Superior ':'';
  if(it.rarity===0){it.base=sup+plain;it.name=it.base;delete it.addOpts;return;}
  it.base=plain;
  if(it.rarity===1){const st=it.affs.filter(a=>a.k!=='skill'),a0=st[0]&&AFF[st[0].k],a1=st[1]&&AFF[st[1].k];it.name=sup+(a0?a0.pre+' ':'')+plain+(a1?' '+a1.suf:'');}
  else if(was!==2)it.name=sup+pick(RARE_A)+' '+pick(RARE_B[it.slot]);}
// Stats Add Stat can roll: the item's pool minus what it already has.
const addPool=it=>{const have=new Set(it.affs.map(a=>a.k));return affPool(it).filter(k=>!have.has(k));};
// Picks one of the rolled options (free: Add Stat already paid). Returns true on success.
function chooseAdd(it,i){const o=it.addOpts&&it.addOpts[i];if(!o||statCount(it)>=MAX_STATS)return false;
  it.affs.push({k:o.k,v:o.v});delete it.addOpts;restat(it);refreshStats();saveChar();return true;}
// ---------- Upgrade Base ----------
// Cost of the step to the next tier; Tier IV and V need Primal Shards. A unique or set item pays 3x gold, 2x materials and 5 more Primal Shards.
const UPBASE_STEP={2:{gold:175,scrap:15,dust:6},3:{gold:500,scrap:30,dust:12,essence:4},4:{gold:1250,scrap:50,dust:20,essence:8,primal:3},5:{gold:3200,scrap:80,dust:30,essence:12,primal:6}};
function upbaseCost(it){const S=UPBASE_STEP[Math.min(5,(it.tier||1)+1)],o={...S};
  if(it.rarity===3||it.rarity===5){o.gold*=3;for(const k of MAT_KEYS)if(o[k])o[k]*=2;o.primal=(o.primal||0)+5;}return o;}
const baseKindName=it=>it.slot==='weapon'?WEAPONS[it.wt].name:it.slot==='body'?BODY[it.kind].name:it.slot==='focus'?FOCUS[it.kind].name:TYPES[it.slot].name;
// Implicits that grow with base level: how much per level (the slope of their roll), or a capped bonus.
const IMP_SLOPE={life:3.5,res:0.8,regen:0.35};
// The base one tier up, without changing the item: {tier, base, dmin, dmax, arm, imp}. Current rolls (and Superior's +15%)
// carry over as a ratio of the base formula, so a well-rolled base stays well rolled.
function upgradedBase(it){const t=it.tier,t2=t+1,b1=baseLvl(t,it.ilvl),b2=baseLvl(t2,it.ilvl),o={tier:t2};
  const plain=String(it.base||'').replace(/^Superior /,''),sameIdx=(lists)=>{const i=Math.max(0,lists[t-1].indexOf(plain));return lists[t2-1][Math.min(i,lists[t2-1].length-1)];};
  let base;
  if(it.slot==='weapon'){const W=WEAPONS[it.wt];base=W.bases[t2-W.act];const r=(5+b2*2.4)/(5+b1*2.4);o.dmin=it.dmin*r;o.dmax=it.dmax*r;}
  else if(it.slot==='body'){base=sameIdx(BODY[it.kind].bases);o.arm=it.arm*(6+b2*3)/(6+b1*3);}
  else if(it.slot==='focus')base=sameIdx(FOCUS[it.kind].bases);
  else base=sameIdx(BASES[it.slot]);
  if(ARM[it.slot]&&it.arm)o.arm=it.arm*(ARM[it.slot][0]+b2*ARM[it.slot][1])/(ARM[it.slot][0]+b1*ARM[it.slot][1]);
  if(it.imp)o.imp=it.imp.map(a=>{a={...a};const d=b2-b1;
    if(it.slot==='shield'&&a.k==='block')a.v+=Math.round(Math.min(8,b2*0.25)-Math.min(8,b1*0.25));
    else if(it.slot==='focus'&&a.k==='spell')a.v+=Math.round(Math.min(10,b2*0.3)-Math.min(10,b1*0.3));
    else if(IMP_SLOPE[a.k])a.v=AFF[a.k].dec?+(a.v+IMP_SLOPE[a.k]*d).toFixed(1):Math.round(a.v+IMP_SLOPE[a.k]*d*(it.slot==='belt'?0.7:1));
    return a;});
  o.base=(it.sup&&it.rarity===0?'Superior ':'')+base;return o;}
function applyUpgradedBase(it){const o=upgradedBase(it);Object.assign(it,o);if(it.rarity===0)it.name=it.base;if(it.rarity===3||it.rarity===5)it.tierUp=true;}
// Base stat lines before → after, for the confirmation popup.
function upbasePreview(it){const o=upgradedBase(it),rows=[['Base',`${esc(it.base)} (Tier ${TIER_NAME[it.tier-1]})`,`${esc(o.base)} (Tier ${TIER_NAME[o.tier-1]})`]];
  if(it.slot==='weapon')rows.push(['Damage',`${Math.round(it.dmin)}–${Math.round(it.dmax)}`,`${Math.round(o.dmin)}–${Math.round(o.dmax)}`]);
  if(it.arm)rows.push(['Armor',Math.round(it.arm),Math.round(o.arm)]);
  (it.imp||[]).forEach((a,i)=>{if(a.k!=='skill'&&o.imp[i].v!==a.v)rows.push(['',esc(affText(a,1,it.cls)),esc(affText(o.imp[i],1,it.cls))]);});
  return rows;}
// Why an operation can't be done on this item (or null if it can), ignoring cost.
function smithBlock(op,it,affIdx){
  if(it.slot==='charm')return 'Charms cannot be smithed';
  if(it.rarity===4)return 'Runebinds cannot be changed';
  if(CRAFT_OPS.has(op)&&craftLimited(it)&&!(op==='add'&&it.addOpts&&it.addOpts.length)&&!craftsLeft(it))return `No crafts left (${craftMax(it)} on ${it.tier?'a Tier '+TIER_NAME[it.tier-1]+' base':'Act '+itemAct(it)+' jewelry'})`;
  if(op==='add'){if(!craftLimited(it))return 'Only white, magic and rare items';if(statCount(it)>=MAX_STATS)return `Already has ${MAX_STATS} stats: remove one first`;return addPool(it).length?null:'No stats left to add';}
  if(op==='remove'){if(!craftLimited(it))return 'Only white, magic and rare items';if(!it.affs.length)return 'No stats to remove';return affIdx==null||!it.affs[affIdx]?'Tap a stat above to choose it':null;}
  if(op==='reforge')return it.rarity===2?null:'Only rares can be reforged';
  if(op==='enchant'){if(!it.affs.length)return 'Only magic, rare and unique items have stats to enchant';return affIdx==null||!it.affs[affIdx]?'Tap a stat above to choose it':null;}
  if(op==='quality'){if(it.rarity>1)return 'Only white and blue items';if(it.sup)return 'Already Superior';return it.slot==='weapon'||it.arm?null:'Has no base damage or armor';}
  if(op==='socket'){if(it.sockets)return 'Only items without sockets';return maxSockets(it)?null:'This item type cannot hold sockets';}
  if(op==='upbase'){if(![0,3,5].includes(it.rarity))return 'Only white items (socketed too), uniques and set items';if(!TIERED.has(it.slot)||!it.tier)return 'Rings and amulets have no base tier';
    if(it.tier>=5)return 'Already Tier V';if(it.rarity!==0&&it.tierUp)return 'Uniques and set items can only be upgraded one tier';return null;}
  return 'Unknown';
}
function canPay(c,cost){const m=matsOf(c);return c.gold>=cost.gold&&MAT_KEYS.every(k=>!cost[k]||m[k]>=cost[k]);}
function pay(c,cost){const m=matsOf(c);c.gold-=cost.gold;for(const k of MAT_KEYS)if(cost[k])m[k]-=cost[k];}
const affPool=it=>(TYPES[it.slot].pool||AFF_KEYS).filter(k=>!AFF[k].cls||AFF[k].cls===it.cls);
// Runs an operation if allowed and affordable. Returns true on success.
function smith(op,it,affIdx){const c=G.char;if(smithBlock(op,it,affIdx))return false;if(op==='add'&&it.addOpts&&it.addOpts.length)return false;
  const cost=SMITH_OPS[op].cost(it);if(!canPay(c,cost))return false;pay(c,cost);
  const rm=it.rarity===3?1.3:1;if(CRAFT_OPS.has(op)&&craftLimited(it))it.crafts=(it.crafts||0)+1;
  if(op==='add')it.addOpts=addPool(it).sort(()=>Math.random()-0.5).slice(0,ADD_OPTS).map(k=>rollAff(k,affLvl(it.ilvl,it.tier)));
  else if(op==='remove'){it.affs.splice(affIdx,1);restat(it);}
  else   if(op==='reforge'){const keys=affPool(it).sort(()=>Math.random()-0.5).slice(0,randi(3,4));it.affs=keys.map(k=>rollAff(k,affLvl(it.ilvl,it.tier),rm));
    if(Math.random()<0.3)it.affs.push({k:'skill',s:randi(0,4),v:1});}
  else if(op==='enchant'){const have=new Set(it.affs.map(a=>a.k)),opts=affPool(it).filter(k=>!have.has(k));
    it.affs[affIdx]=opts.length?rollAff(pick(opts),affLvl(it.ilvl,it.tier),rm):rollAff(it.affs[affIdx].k==='skill'?pick(affPool(it)):it.affs[affIdx].k,affLvl(it.ilvl,it.tier),rm);
    if(it.rarity===1)restat(it);}
  else if(op==='quality'){it.sup=true;if(it.slot==='weapon'){it.dmin*=1.15;it.dmax*=1.15;}if(it.arm)it.arm*=1.15;it.name='Superior '+it.name;if(it.rarity===0)it.base='Superior '+it.base;}
  else if(op==='socket')it.sockets=1;
  else if(op==='upbase')applyUpgradedBase(it);
  refreshStats();saveChar();return true;}

// ---------- salvage ----------
// Locked (favorite) items are never salvaged: not one by one, not in bulk.
const isLocked=it=>!!(it&&it.lock);
function toggleLock(it){if(it.lock)delete it.lock;else it.lock=true;saveChar();return !!it.lock;}
// Salvages one bag item: gold, materials, and any socketed gems/runes go back to the pouch.
function salvageItem(c,it){const i=c.bag.indexOf(it);if(i<0||isLocked(it))return null;c.bag.splice(i,1);returnStones(c,it);
  const gold=salvageValue(it);c.gold+=gold;return {gold,mats:grantSalvage(c,it)};}
// Bag items the bulk button for a rarity takes. Locked items, charms and socketed items (Runebind bases, gems inside) are kept.
const bulkSalvageItems=(c,r)=>c.bag.filter(it=>it.rarity===r&&it.slot!=='charm'&&!it.sockets&&!isLocked(it));
// What a bulk salvage would give, without doing it.
function bulkSalvagePreview(c,r){const items=bulkSalvageItems(c,r),mats={};let gold=0;
  for(const it of items){gold+=salvageValue(it);addMats(mats,salvageMats(it));}
  const rest=c.bag.filter(it=>it.rarity===r&&it.slot!=='charm'&&!items.includes(it));
  return {items,gold,mats,kept:rest.length,locked:rest.filter(isLocked).length};}
function bulkSalvage(c,r){const {items}=bulkSalvagePreview(c,r),mats={};let gold=0;
  for(const it of items){const g=salvageItem(c,it);gold+=g.gold;addMats(mats,g.mats);}
  if(items.length)saveChar();return {n:items.length,gold,mats};}
const BULK=[{r:0,label:'white'},{r:1,label:'blue'},{r:2,label:'yellow'}];
// ---------- multi-select salvage (v1.0.50) ----------
// The Salvage tab has three tap modes: Inspect (one item, as before), Select (tap items to pick several) and Lock (tap
// to lock/unlock). Quick buttons add to the selection; they never take locked items, charms, uniques, set items or
// Runebinds (those can still be tapped in by hand, except locked ones). The rarity buttons leave socketed items out
// (they have their own button), since a socketed white is a Runebind base.
let salvMode='one';const salvPick=new Set();
const autoPickable=it=>it.slot!=='charm'&&!isLocked(it)&&it.rarity<=2;
const worseThanWorn=(c,it)=>{if(it.slot==='charm')return false;if(!fitsFor(c,it).length)return true;return power(calcStats(c,it))<power(calcStats(c))*0.999;};
const QUICK=[{k:'r0',label:'Normal',col:RCOL[0],f:(c,it)=>it.rarity===0&&!it.sockets},{k:'r1',label:'Magic',col:RCOL[1],f:(c,it)=>it.rarity===1&&!it.sockets},
  {k:'r2',label:'Rare',col:RCOL[2],f:(c,it)=>it.rarity===2&&!it.sockets},{k:'sock',label:'With sockets',col:'#9a8a70',f:(c,it)=>!!it.sockets},
  {k:'worse',label:'Worse than worn',col:'#c06050',f:worseThanWorn}];
const quickItems=(c,k)=>{const Q=QUICK.find(q=>q.k===k);return Q?c.bag.filter(it=>autoPickable(it)&&Q.f(c,it)):[];};
function quickPick(c,k){for(const it of quickItems(c,k))salvPick.add(it);}
function togglePick(it){if(salvPick.has(it))salvPick.delete(it);else if(!isLocked(it))salvPick.add(it);}
// Drops picks that left the bag or got locked; returns the picked bag items in bag order.
function pickedItems(c){for(const it of [...salvPick])if(!c.bag.includes(it)||isLocked(it))salvPick.delete(it);return c.bag.filter(it=>salvPick.has(it));}
function pickPreview(c){const items=pickedItems(c),mats={},by=[0,0,0,0,0,0];let gold=0,stones=0;
  for(const it of items){gold+=salvageValue(it);addMats(mats,salvageMats(it));by[it.rarity]++;if(!it.rb)stones+=(it.socketed||[]).length;}
  return {items,gold,mats,by,stones};}
function salvagePicked(c){const items=pickedItems(c),mats={};let gold=0,n=0;
  for(const it of items){const g=salvageItem(c,it);if(!g)continue;n++;gold+=g.gold;addMats(mats,g.mats);}
  salvPick.clear();if(n)saveChar();return {n,gold,mats};}
function askPicked(){const c=G.char,p=pickPreview(c);if(!p.items.length)return;
  const parts=p.by.map((n,r)=>n?`<span style="color:${RCOL[r]}">${n} ${RNAME[r].toLowerCase()}</span>`:'').filter(Boolean).join(', ');
  askSmith(`<h3>Salvage ${p.items.length} item${p.items.length>1?'s':''}?</h3><p>${parts} will be destroyed. You get:</p>
    <div class="card">${[`<div>🪙 ${p.gold} gold</div>`].concat(MAT_KEYS.filter(k=>p.mats[k]).map(k=>`<div>${MATS[k].ic} ${p.mats[k]} ${MATS[k].name}</div>`)).join('')}</div>
    ${p.stones?`<p class="fdim">${p.stones} gem${p.stones>1?'s':''}/rune${p.stones>1?'s':''} in their sockets go back to your pouch.</p>`:''}
    ${p.by[3]||p.by[5]||p.by[4]?'<p style="color:#e0a050">Includes uniques, set items or Runebinds you picked by hand.</p>':''}`,'Salvage',()=>{
    const r=salvagePicked(G.char);if(r.n)toast(`Salvaged ${r.n} item${r.n>1?'s':''}`,`+${r.gold} gold ${matText(r.mats)}`);smithSel=null;renderSmith();});}
function setSalvMode(m){salvMode=m;if(m!=='pick')salvPick.clear();smithSel=null;renderSmith();}
function renderSalvageBar(){const c=G.char,el=$('smithBulk');
  let h=`<div class="row smmodes">${[['one','👆 Inspect'],['pick','☑ Select'],['lock','🔒 Lock']].map(([k,n])=>`<div class="btn sm${salvMode===k?' on':''}" data-m="${k}">${n}</div>`).join('')}</div>`;
  if(salvMode==='pick')h+=`<div class="row smquick">${QUICK.map(q=>{const n=quickItems(c,q.k).length;return `<div class="btn sm${n?'':' dis'}" data-q="${q.k}" style="border-color:${q.col}">${q.label} (${n})</div>`;}).join('')}<div class="btn sm${salvPick.size?'':' dis'}" data-q="clear">Clear</div></div>`;
  el.innerHTML=h;
  el.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>setSalvMode(b.dataset.m));
  el.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{if(b.dataset.q==='clear')salvPick.clear();else quickPick(c,b.dataset.q);renderSmith();});}
function renderPickInfo(){const c=G.char,p=pickPreview(c);
  if(salvMode==='lock'){$('smithInfo').innerHTML=`<p class="fdim">Tap items to lock 🔒 or unlock them. Locked items are never salvaged and never picked by the quick buttons.</p>`;return;}
  $('smithInfo').innerHTML=`<p class="fdim">Tap items to pick or unpick them, or use the quick buttons (they skip 🔒 locked items, charms, uniques, set items and Runebinds).</p>
    <div style="margin:8px 0"><b>${p.items.length}</b> selected${p.items.length?` · ${matLine(p.gold,p.mats)}`:''}${p.stones?` · ${p.stones} gems/runes back`:''}</div>
    <div class="row"><div class="btn sm red${p.items.length?'':' dis'}" id="smSalvPick">Salvage selected (${p.items.length})</div></div>`;
  $('smSalvPick').onclick=askPicked;}

// ---------- UI ----------
let smithSel=null,smithAff=null,smithTab='craft',smithAskFn=null;
function openSmith(){if(!G.char||G.paused||!G.inTown)return;salvMode='one';salvPick.clear();smithSel=null;smithAff=null;smithTab='craft';smithAskFn=null;$('smithOv').classList.remove('hidden');$('smithAsk').classList.add('hidden');renderSmith();setPause();}
function closeSmith(){$('smithOv').classList.add('hidden');$('smithAsk').classList.add('hidden');smithAskFn=null;setPause();}
function setSmithTab(t){smithTab=t;salvPick.clear();smithSel=null;smithAff=null;renderSmith();}
function smithItems(){const c=G.char;return smithTab==='salvage'?c.bag.slice():EQ_SLOTS.map(s=>c.equip[s]).filter(Boolean).concat(c.bag.filter(it=>it.slot!=='charm'));}
function costHtml(cost){const c=G.char,m=matsOf(c);return `<span class="${c.gold>=cost.gold?'':'no'}">${cost.gold}🪙</span>`+MAT_KEYS.filter(k=>cost[k]).map(k=>` <span class="${m[k]>=cost[k]?'':'no'}">${cost[k]}${MATS[k].ic}</span>`).join('');}
const matLine=(gold,m)=>`+${gold}🪙`+MAT_KEYS.filter(k=>m[k]).map(k=>` &nbsp;+${m[k]} ${MATS[k].ic} ${MATS[k].name}`).join('');
const MAT_HELP=`🔩 Iron Scrap (white), ✨ Arcane Dust (blue), 💠 Rare Essence (yellow), 🔶 Primal Shard (unique and Runebind). Items from later acts give more: up to x3 in Act 5.`;
function renderSmith(){
  const c=G.char,m=matsOf(c),items=smithItems();
  $('smithTabs').innerHTML=[['craft','🔨 Craft'],['salvage','♻️ Salvage']].map(([k,n])=>`<div class="tab${k===smithTab?' on':''}" data-t="${k}">${n}</div>`).join('');
  $('smithTabs').querySelectorAll('[data-t]').forEach(el=>el.onclick=()=>setSmithTab(el.dataset.t));
  $('smithMats').innerHTML=`🪙 <b style="color:var(--gold);font-weight:normal">${c.gold}</b> &nbsp; `+MAT_KEYS.map(k=>`<span title="${MATS[k].name}">${MATS[k].ic} ${m[k]}</span>`).join(' &nbsp; ');
  if(smithSel&&!items.includes(smithSel)){smithSel=null;smithAff=null;}
  const multi=smithTab==='salvage'&&salvMode!=='one';if(multi)pickedItems(c);
  $('smithGrid').innerHTML=items.length?items.map(it=>cellHtml(it).replace('class="cell','class="cell'+(it===smithSel&&!multi?' sel':'')+(multi&&salvPick.has(it)?' pick':''))).join(''):'<p class="fdim" style="grid-column:1/-1">Your bag is empty.</p>';
  [...$('smithGrid').children].forEach((el,i)=>{if(items[i])el.onclick=()=>{const it=items[i];
    if(multi&&salvMode==='pick')togglePick(it);else if(multi){toggleLock(it);salvPick.delete(it);}else{smithSel=it;smithAff=null;}renderSmith();};});
  $('smithBulk').classList.toggle('hidden',smithTab!=='salvage');
  if(smithTab==='salvage'){renderSalvageBar();return multi?renderPickInfo():renderSalvageInfo();}
  const it=smithSel;
  if(!it){$('smithInfo').innerHTML=`<p class="fdim">Pick an item (worn or in your bag). Salvage items in the Salvage tab for ${MAT_HELP}</p>`;return;}
  let h=`<div class="iname" style="color:${RCOL[it.rarity]}">${esc(it.name)}</div><div class="isub">${RNAME[it.rarity]} ${typeLabel(it)}${it.tier?' · '+tierLabel(it):''}${it.sup?' · Superior':''}</div>`;
  if(craftLimited(it))h+=`<div class="isub">⚒ Stat crafts left: <b style="color:${craftsLeft(it)?'var(--gold)':'#e07a5a'}">${craftsLeft(it)}/${craftMax(it)}</b>${it.rarity===0&&it.tier&&it.tier<5&&!it.crafts?' · Upgrade Base first for more':''}</div>`;
  if(it.slot==='weapon')h+=`<div class="ibase">Damage: ${Math.round(it.dmin)}–${Math.round(it.dmax)}</div>`;else if(it.arm)h+=`<div class="ibase">Armor: ${Math.round(it.arm)}</div>`;
  h+=it.affs.map((a,i)=>`<div class="iaff sm-aff${i===smithAff?' sel':''}" data-a="${i}">${esc(affText(a,affMul(it),it.cls||c.cls))}</div>`).join('');
  h+='<div class="smops">'+Object.entries(SMITH_OPS).map(([k,O])=>{const why=smithBlock(k,it,smithAff),cost=O.cost(it),ok=!why&&canPay(c,cost);
    return `<div class="smop"><div class="btn sm${ok?'':' dis'}" data-op="${k}">${O.name}</div><div><div>${esc(typeof O.desc==='function'?O.desc(it):O.desc)}</div><div class="fdim">${why?esc(why):costHtml(cost)}</div></div></div>`;}).join('')+'</div>';
  $('smithInfo').innerHTML=h;
  $('smithInfo').querySelectorAll('[data-a]').forEach(el=>el.onclick=()=>{smithAff=+el.dataset.a;renderSmith();});
  $('smithInfo').querySelectorAll('[data-op]').forEach(el=>el.onclick=()=>{const op=el.dataset.op;
    if(op==='upbase')return askUpbase(it);
    if(op==='add'){if(it.addOpts&&it.addOpts.length)return askAdd(it);if(smith('add',it)){renderSmith();askAdd(it);}return;}
    if(op==='remove'){if(smith('remove',it,smithAff)){toast('Stat removed',it.name);smithAff=null;renderSmith();}return;}
    if(smith(op,it,smithAff)){toast(SMITH_OPS[op].name,it.name);if(op!=='enchant')smithAff=null;renderSmith();}});
}
function renderSalvageInfo(){const c=G.char,it=smithSel;
  if(!it){$('smithInfo').innerHTML=`<p class="fdim">Tap a bag item to salvage it, or switch to ☑ Select to salvage several at once. Salvaging gives gold and ${MAT_HELP}</p>`;return;}
  const g=salvageMats(it),stones=(it.socketed||[]).length&&!it.rb;
  $('smithInfo').innerHTML=`<div class="iname" style="color:${RCOL[it.rarity]}">${esc(it.name)}</div><div class="isub">${RNAME[it.rarity]} ${typeLabel(it)} · Item level ${it.ilvl} · Act ${itemAct(it)} (x${salvageMul(it)})</div>
    <div style="margin:8px 0">${matLine(salvageValue(it),g)}</div>${stones?'<div class="fdim">Its gems and runes go back to your pouch.</div>':''}
    ${isLocked(it)?'<div class="fdim">🔒 Locked: unlock it to salvage.</div>':''}
    <div class="row"><div class="btn sm" id="smLock">${isLocked(it)?'🔓 Unlock':'🔒 Lock'}</div><div class="btn sm red${isLocked(it)?' dis':''}" id="smSalv">Salvage</div></div>`;
  $('smLock').onclick=()=>{toggleLock(it);renderSmith();};
  $('smSalv').onclick=()=>{const r=salvageItem(c,it);if(!r)return;toast('Salvaged',`+${r.gold} gold ${matText(r.mats)}`);smithSel=null;saveChar();renderSmith();};}
// Confirmation popup (bulk salvage, Upgrade Base): smithAskFn holds what to do on confirm.
function askSmith(html,yes,fn){smithAskFn=fn;$('smithAskNo').classList.remove('hidden');$('smithAskBody').innerHTML=html;$('smithAskYes').textContent=yes;$('smithAsk').classList.remove('hidden');}
function askUpbase(it){const c=G.char;if(smithBlock('upbase',it))return;const cost=upbaseCost(it);if(!canPay(c,cost))return;
  askSmith(`<h3 style="color:${RCOL[it.rarity]}">Upgrade ${esc(it.name)}?</h3>
    <table class="upcmp">${upbasePreview(it).map(([a,b,n])=>`<tr><td class="fdim">${a}</td><td>${b}</td><td>→</td><td class="up2">${n}</td></tr>`).join('')}</table>
    <p class="fdim">Stats, sockets${it.sup?', Superior':''} and +${it.upg||0} upgrades stay.${it.rarity===3||it.rarity===5?' Uniques and set items can only do this once.':''}</p><p>Cost: ${costHtml(cost)}</p>`,'Upgrade',()=>{
    if(smith('upbase',it)){toast('Base upgraded',`${it.name} · Tier ${TIER_NAME[it.tier-1]}`);renderSmith();}});}
// Add Stat: pick one of the rolled stats. Already paid, so there is no cancel; closing keeps the options for later.
function askAdd(it){if(!it.addOpts||!it.addOpts.length)return;const cls=it.cls||G.char.cls;
  askSmith(`<h3>Add a stat to ${esc(it.name)}</h3><p class="fdim">Pick one. ${it.affs.length+1>=3&&it.rarity<2?'It becomes a Rare.':!it.affs.length?'It becomes Magic.':''}</p>
    <div class="smops">${it.addOpts.map((a,i)=>`<div class="btn sm" data-add="${i}">${esc(affText(a,affMul(it),cls))}</div>`).join('')}</div>`,'Later',()=>{});
  $('smithAskNo').classList.add('hidden');
  $('smithAskBody').querySelectorAll('[data-add]').forEach(el=>el.onclick=()=>{if(chooseAdd(it,+el.dataset.add)){toast('Stat added',it.name);cancelBulk();renderSmith();}});}
// Confirmation popup for a bulk salvage: what goes and what you get.
function askBulk(r){const c=G.char,p=bulkSalvagePreview(c,r);if(!p.items.length)return;
  const html=`<h3 style="color:${RCOL[r]}">Salvage all ${BULK[r].label}?</h3>
    <p>${p.items.length} ${RNAME[r].toLowerCase()} item${p.items.length>1?'s':''} will be destroyed. You get:</p>
    <div class="card" style="border-color:${RCOL[r]}">${[`<div>🪙 ${p.gold} gold</div>`].concat(MAT_KEYS.filter(k=>p.mats[k]).map(k=>`<div>${MATS[k].ic} ${p.mats[k]} ${MATS[k].name}</div>`)).join('')}</div>
    ${p.kept?`<p class="fdim">${p.kept} kept: ${[p.locked&&`${p.locked} locked`,p.kept-p.locked&&`${p.kept-p.locked} socketed`].filter(Boolean).join(', ')}.</p>`:''}`;
  askSmith(html,'Salvage',()=>{const res=bulkSalvage(G.char,r);if(res.n)toast(`Salvaged ${res.n} items`,`+${res.gold} gold ${matText(res.mats)}`);smithSel=null;renderSmith();});}
function confirmBulk(){const fn=smithAskFn;$('smithAsk').classList.add('hidden');smithAskFn=null;if(fn)fn();}
function cancelBulk(){$('smithAsk').classList.add('hidden');smithAskFn=null;}
tap('smithBtn',openSmith);
tap('smithClose',closeSmith);
tap('smithAskYes',confirmBulk);
tap('smithAskNo',cancelBulk);
