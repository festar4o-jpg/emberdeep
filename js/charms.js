'use strict';
// Charms: small items that give their stats just by sitting in the character's charm pouch (9 slots, separate from
// the bag). Small charms take 1 slot, medium 2, large 3. Rare grand charms (3 slots) add +1 to one of your skills.
// Charms drop as items into the bag; move them into the pouch from their item card.
// v1.0.62: charm-only stats (Item Rarity, Gold Found, Experience, Life per Kill, Potion Healing; large and grand:
// maximum Resistances), crafting with currency (currency.js: Shard, Cinder, Tear, Void Ash, Star-Iron, up to the
// size's max stats), and five unique charms, one per act boss in Hell (UCHARMS), only one of each in the pouch.
const CHARM_SLOTS=9;
// n: stats it drops with; max: most stats crafting can give it (grand: plus its skill).
const CHARM={
  small:{name:'Small Charm',slots:1,m:0.35,n:[1,1],max:1,w:55},
  medium:{name:'Medium Charm',slots:2,m:0.55,n:[1,2],max:2,w:30},
  large:{name:'Large Charm',slots:3,m:0.8,n:[2,2],max:3,w:13},
  grand:{name:'Grand Charm',slots:3,m:0.5,n:[1,1],max:2,w:2}
};
const CHARM_POOL=['life','res','dmg','armor','crit','critd','aspd','cspd','cdr','move','loh','regen','spell','resist','rarity','gold','xp','lpk','potheal','maxres'];
// What a charm of this size can roll, and a stat's value multiplier on it (nom: the same on every size).
const charmPool=(it,cls)=>CHARM_POOL.filter(k=>(!AFF[k].cls||AFF[k].cls===cls)&&(!AFF[k].lg||it.size==='large'||it.size==='grand'));
const charmRm=(it,k)=>AFF[k].nom?1:CHARM[it.size].m;
const charmAff=(it,k)=>rollAff(k,it.ilvl,charmRm(it,k),{il:it.ilvl});
function charmName(it){if(it.uc)return UCHARMS[it.uc].name;const C=CHARM[it.size],st=it.affs.filter(x=>x.k!=='skill'),a=st[0],b=st[1],sk=it.affs.find(x=>x.k==='skill');
  return it.size==='grand'&&sk?`${a?AFF[a.k].pre+' ':''}Grand Charm of ${skName(it.cls,sk.s)}`:`${a?AFF[a.k].pre+' ':''}${C.name}${b?' '+AFF[b.k].suf:''}`;}
// ---------- unique charms: one per act boss, dropping in Hell (Waystone "Boss only" makes it a farm) ----------
// Fixed stats [key, low, high]; large (3 slots); only one of each in the pouch.
const UCHARMS={
  lantern:{name:"Varrok's Grave-Lantern",act:1,stats:[['allsk',1,1],['ares',10,15],['xp',8,12]],lore:'It still burns with the light of the last grave he dug.'},
  sandglass:{name:"The Tyrant's Sandglass",act:2,stats:[['aspd',8,12],['move',6,9],['gold',30,45],['lres',25,35]],lore:'Every grain of sand a soldier he buried.'},
  seed:{name:'Seed of the Rot Mother',act:3,stats:[['lpk',60,90],['regen',25,40],['pres',30,40]],lore:'Warm, and faintly beating.'},
  heart:{name:"Rimeheart's Shard",act:4,stats:[['maxres',2,2],['cres',30,40],['armor',120,180],['life',90,130]],lore:'Cold enough to burn the hand that holds it.'},
  ember:{name:"The Cinder King's Ember",act:5,stats:[['allsk',1,1],['dmg',14,20],['fres',30,40],['rarity',20,30]],lore:'The last spark of a dead god of fire.'}
};
const UCHARM_CH=0.15;
function genUCharm(k,ilvl,cls){const U=UCHARMS[k],it={id:++ITEM_ID,slot:'charm',size:'large',ilvl,cls,upg:0,rarity:3,uc:k,affs:[]};
  for(const [s,lo,hi] of U.stats)it.affs.push({k:s,v:AFF[s].dec?+rand(lo,hi).toFixed(1):randi(lo,hi)});it.name=U.name;return it;}
// An act boss in Hell may drop its charm.
function dropUCharm(e){const c=G.char;if(!c||(G.depth||1)>25||diffHere()!==2||Math.random()>=UCHARM_CH)return;const a=actIdx(G.depth)+1,k=Object.keys(UCHARMS).find(x=>UCHARMS[x].act===a);
  if(k){dropItem(e.x+rand(-40,40),e.y+rand(-40,40),genUCharm(k,PD()+3,c.cls));toast('A unique charm!',UCHARMS[k].name);}}
const charmSlots=it=>CHARM[it.size].slots;
const charmsOf=c=>Array.isArray(c.charms)?c.charms:(c.charms=[]);
const charmUsed=c=>charmsOf(c).reduce((a,it)=>a+charmSlots(it),0);
const charmFits=(c,it)=>charmUsed(c)+charmSlots(it)<=CHARM_SLOTS;
function rollCharmSize(boss){let r=Math.random()*100;if(boss&&r<10)return 'grand';for(const [k,C] of Object.entries(CHARM)){r-=C.w;if(r<0)return k;}return 'small';}
function genCharm(ilvl,cls,size){
  const C=CHARM[size],it={id:++ITEM_ID,slot:'charm',size,ilvl,cls,upg:0,rarity:size==='grand'?2:1,affs:[]};
  const keys=charmPool(it,cls).sort(()=>Math.random()-0.5).slice(0,randi(C.n[0],C.n[1]));
  for(const k of keys)it.affs.push(charmAff(it,k)); // items.js: affix tiers
  if(size==='grand')it.affs.unshift({k:'skill',s:randi(0,4),v:1});
  it.name=charmName(it);return it;
}
// Own roll, separate from item drops (so slot weights and bad-luck protection are untouched).
const CHARM_DROP={normal:0.01,elite:0.04,boss:0.5}; // v1.0.99: normal and elite about 30% less
function dropCharms(e,kind){if(Math.random()<CHARM_DROP[kind]*lootHere().drop)dropItem(e.x+rand(-20,20),e.y+rand(-20,20),genCharm(PD(),G.char.cls,rollCharmSize(kind==='boss')));}
// Stats from the pouch; a grand charm's skill only counts for the class it was made for.
function addCharmStats(c,s){for(const it of charmsOf(c))for(const a of it.affs){if(a.k==='skill'){if(it.cls===c.cls)s.skill[a.s]+=a.v;}else if(a.k==='allsk')s.skill=s.skill.map(x=>x+a.v);else{const k=spdKey(a.k,c.cls);s[k]=(s[k]||0)+a.v;}}}
// Only one of each unique charm in the pouch.
const ucharmClash=(c,it)=>!!it.uc&&charmsOf(c).some(x=>x.uc===it.uc&&x!==it);
function charmIn(it){const c=G.char,i=c.bag.indexOf(it);if(i<0||!charmFits(c,it)||ucharmClash(c,it))return false;c.bag.splice(i,1);charmsOf(c).push(it);refreshStats();saveChar();return true;}
function charmOut(it){const c=G.char,i=charmsOf(c).indexOf(it);if(i<0||c.bag.length>=30)return false;c.charms.splice(i,1);c.bag.push(it);refreshStats();saveChar();return true;}
// Save cleanup: only valid charms, and never more than 9 slots (the rest go back to the bag).
function migrateCharms(c){const keep=[];let used=0;
  for(let it of Array.isArray(c.charms)?c.charms:[]){if(!it||it.slot!=='charm'||!CHARM[it.size])continue;it=migrateItem(it);if(!it)continue; /* items.js: stat tiers and the other item rules */if(it.uc&&(!UCHARMS[it.uc]||keep.some(x=>x.uc===it.uc))){c.bag.push(it);continue;}if(used+charmSlots(it)<=CHARM_SLOTS){keep.push(it);used+=charmSlots(it);}else c.bag.push(it);}
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
  let h=tipCard(it,c).replace(/<\/div>$/,''); // ui.js: the same card as gear
  h+=`<div class="tmeta">${C.slots} pouch slot${C.slots>1?'s':''}</div>`;
  if(it.uc)h+=`<div class="tlore">${esc(UCHARMS[it.uc].lore)}</div><div class="tfoot">Unique charm: only one of each in the pouch</div>`;
  h+=`<div class="tfoot">Works while it's in your charm pouch (${charmUsed(c)}/${CHARM_SLOTS} slots used)</div></div>`;
  const clash=!inPouch&&ucharmClash(c,it),fits=charmFits(c,it)&&!clash;
  h+=`<div class="row">${inPouch?'<div class="btn sm" id="cOut">Take out</div>':`<div class="btn sm${fits?'':' dis'}" id="cIn">Put in charm pouch</div>`}
    <div class="btn sm" id="iLock">${it.lock?'🔓 Unlock':'🔒 Lock'}</div>${inPouch?'':`<div class="btn sm red${it.lock?' dis':''}" id="iSalv">Salvage (+${salvageValue(it)}🪙)</div>`}<div class="btn sm" id="iClose">Close</div></div>`;
  if(clash)h+=`<div class="cmp dn">You already carry ${esc(it.name)} in your pouch.</div>`;
  else if(!inPouch&&!fits)h+=`<div class="cmp dn">Not enough room: needs ${C.slots} free slot${C.slots>1?'s':''}.</div>`;
  $('itemPanel').innerHTML=h;$('itemPanel').classList.remove('cvp');$('itemOv').classList.remove('hidden');setPause();
  if(inPouch)$('cOut').onclick=()=>{if(!charmOut(it)){toast('Bag is full');return;}closeItem();renderInv();};
  else{$('cIn').onclick=()=>{if(!charmIn(it)){toast('Charm pouch is full',`Needs ${C.slots} free slot${C.slots>1?'s':''}`);return;}closeItem();renderInv();};
    $('iSalv').onclick=()=>{const r=salvageItem(c,it);if(!r)return;toast('Salvaged',`+${r.gold} gold ${matText(r.mats)}`);closeItem();renderInv();saveChar();};}
  $('iLock').onclick=()=>{toggleLock(it);renderInv();openCharm(it,inPouch);};
  $('iClose').onclick=closeItem;
}
