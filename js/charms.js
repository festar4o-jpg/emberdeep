'use strict';
// Charms: small items that give their stats just by sitting in the character's charm pouch (9 slots, separate from
// the bag). Small charms take 1 slot, medium 2, large 3. Rare grand charms (3 slots) add +1 to one of your skills.
// Charms drop as items into the bag; move them into the pouch from their item card.
const CHARM_SLOTS=9;
const CHARM={
  small:{name:'Small Charm',slots:1,m:0.35,n:[1,1],w:55},
  medium:{name:'Medium Charm',slots:2,m:0.55,n:[1,2],w:30},
  large:{name:'Large Charm',slots:3,m:0.8,n:[2,2],w:13},
  grand:{name:'Grand Charm',slots:3,m:0.5,n:[1,1],w:2}
};
const CHARM_POOL=['life','res','dmg','armor','crit','critd','aspd','cdr','move','loh','regen','spell','resist'];
const charmSlots=it=>CHARM[it.size].slots;
const charmsOf=c=>Array.isArray(c.charms)?c.charms:(c.charms=[]);
const charmUsed=c=>charmsOf(c).reduce((a,it)=>a+charmSlots(it),0);
const charmFits=(c,it)=>charmUsed(c)+charmSlots(it)<=CHARM_SLOTS;
function rollCharmSize(boss){let r=Math.random()*100;if(boss&&r<10)return 'grand';for(const [k,C] of Object.entries(CHARM)){r-=C.w;if(r<0)return k;}return 'small';}
function genCharm(ilvl,cls,size){
  const C=CHARM[size],it={id:++ITEM_ID,slot:'charm',size,ilvl,cls,upg:0,rarity:size==='grand'?2:1,affs:[]};
  const keys=CHARM_POOL.filter(k=>!AFF[k].cls||AFF[k].cls===cls).sort(()=>Math.random()-0.5).slice(0,randi(C.n[0],C.n[1]));
  for(const k of keys)it.affs.push(rollAff(k,ilvl,C.m));
  if(size==='grand')it.affs.unshift({k:'skill',s:randi(0,4),v:1});
  const a=it.affs.find(x=>x.k!=='skill'),b=it.affs.filter(x=>x.k!=='skill')[1];
  it.name=size==='grand'?`${a?AFF[a.k].pre+' ':''}Grand Charm of ${SKILLS[cls][it.affs[0].s].name}`:`${a?AFF[a.k].pre+' ':''}${C.name}${b?' '+AFF[b.k].suf:''}`;
  return it;
}
// Own roll, separate from item drops (so slot weights and bad-luck protection are untouched).
const CHARM_DROP={normal:0.015,elite:0.06,boss:0.5};
function dropCharms(e,kind){if(Math.random()<CHARM_DROP[kind]*lootHere().drop)dropItem(e.x+rand(-20,20),e.y+rand(-20,20),genCharm(PD(),G.char.cls,rollCharmSize(kind==='boss')));}
// Stats from the pouch; a grand charm's skill only counts for the class it was made for.
function addCharmStats(c,s){for(const it of charmsOf(c))for(const a of it.affs){if(a.k==='skill'){if(it.cls===c.cls)s.skill[a.s]+=a.v;}else s[a.k]+=a.v;}}
function charmIn(it){const c=G.char,i=c.bag.indexOf(it);if(i<0||!charmFits(c,it))return false;c.bag.splice(i,1);charmsOf(c).push(it);refreshStats();saveChar();return true;}
function charmOut(it){const c=G.char,i=charmsOf(c).indexOf(it);if(i<0||c.bag.length>=30)return false;c.charms.splice(i,1);c.bag.push(it);refreshStats();saveChar();return true;}
// Save cleanup: only valid charms, and never more than 9 slots (the rest go back to the bag).
function migrateCharms(c){const keep=[];let used=0;
  for(const it of Array.isArray(c.charms)?c.charms:[]){if(!it||it.slot!=='charm'||!CHARM[it.size])continue;if(used+charmSlots(it)<=CHARM_SLOTS){keep.push(it);used+=charmSlots(it);}else c.bag.push(it);}
  c.charms=keep;}

// ---------- UI: the charm row in the inventory, and the charm item card ----------
function renderCharms(){
  const c=G.char,cs=charmsOf(c);let h='';
  for(const it of cs)h+=`<div class="cell" style="grid-column:span ${charmSlots(it)};border-color:${RCOL[it.rarity]}">${itemIcon(it)}${it.lock?'<span class="lock">🔒</span>':''}</div>`;
  for(let i=charmUsed(c);i<CHARM_SLOTS;i++)h+='<div class="cell empty"></div>';
  $('charmGrid').innerHTML=h;$('charmN').textContent=`${charmUsed(c)}/${CHARM_SLOTS}`;
  [...$('charmGrid').children].forEach((el,i)=>{if(cs[i])el.onclick=()=>openItem(cs[i],'charm');});
}
function openCharm(it,inPouch){
  const c=G.char,C=CHARM[it.size];
  let h=`<div class="card" style="border-color:${RCOL[it.rarity]}"><div class="chead"><div class="cicon">${itemIcon(it)}</div><div><div class="iname" style="color:${RCOL[it.rarity]}">${esc(it.name)}</div><div class="isub">${C.name} · ${C.slots} pouch slot${C.slots>1?'s':''} · Item level ${it.ilvl}</div></div></div>`;
  for(const a of it.affs){const off=a.k==='skill'&&it.cls!==c.cls;h+=`<div class="iaff${a.k==='skill'?' skl':''}${off?' off':''}">${esc(affText(a,1,it.cls||c.cls))}${off?` <small>(${CLASSES[it.cls].name} only)</small>`:''}</div>`;}
  h+=`<div class="ibase" style="color:var(--dim)">Works while it's in your charm pouch (${charmUsed(c)}/${CHARM_SLOTS} slots used)</div></div>`;
  const fits=charmFits(c,it);
  h+=`<div class="row">${inPouch?'<div class="btn sm" id="cOut">Take out</div>':`<div class="btn sm${fits?'':' dis'}" id="cIn">Put in charm pouch</div>`}
    <div class="btn sm" id="iLock">${it.lock?'🔓 Unlock':'🔒 Lock'}</div>${inPouch?'':`<div class="btn sm red${it.lock?' dis':''}" id="iSalv">Salvage (+${salvageValue(it)}🪙)</div>`}<div class="btn sm" id="iClose">Close</div></div>`;
  if(!inPouch&&!fits)h+=`<div class="cmp dn">Not enough room: needs ${C.slots} free slot${C.slots>1?'s':''}.</div>`;
  $('itemPanel').innerHTML=h;$('itemOv').classList.remove('hidden');setPause();
  if(inPouch)$('cOut').onclick=()=>{if(!charmOut(it)){toast('Bag is full');return;}closeItem();renderInv();};
  else{$('cIn').onclick=()=>{if(!charmIn(it)){toast('Charm pouch is full',`Needs ${C.slots} free slot${C.slots>1?'s':''}`);return;}closeItem();renderInv();};
    $('iSalv').onclick=()=>{const r=salvageItem(c,it);if(!r)return;toast('Salvaged',`+${r.gold} gold ${matText(r.mats)}`);closeItem();renderInv();saveChar();};}
  $('iLock').onclick=()=>{toggleLock(it);renderInv();openCharm(it,inPouch);};
  $('iClose').onclick=closeItem;
}
