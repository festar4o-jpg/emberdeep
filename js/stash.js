'use strict';
// Stash: a chest in town shared by every character. 3 tabs × 40 slots, saved under its own key
// (not inside a character), so deleting a character never touches it. Tap an item (stash or bag) to see its card with
// a comparison and Move / Equip / Lock buttons; double-tap or hold to move it at once. Filters and sorting only change
// what the stash grid shows, never where items are stored.
const STASH_KEY='emberdeep_stash',STASH_TABS=3,STASH_SLOTS=40,BAG_SIZE=30;
let STASH=null,stashTab=0;
const emptyStash=()=>({ver:SAVE_VER,tabs:Array.from({length:STASH_TABS},()=>Array(STASH_SLOTS).fill(null))});
// Loads the stash at boot. Items go through the same migration as character items; a stash that
// can't be read is kept under a backup key instead of being overwritten.
function loadStash(){
  let raw=null,s=null;try{raw=localStorage.getItem(STASH_KEY);}catch(e){}
  if(raw){try{s=JSON.parse(raw);}catch(e){try{localStorage.setItem(STASH_KEY+'_unreadable',raw);}catch(e2){}}}
  const st=emptyStash();
  if(s&&Array.isArray(s.tabs))s.tabs.slice(0,STASH_TABS).forEach((t,i)=>{if(!Array.isArray(t))return;
    for(let j=0;j<STASH_SLOTS;j++){let it=null;try{it=t[j]&&typeof t[j]==='object'?migrateItem(t[j]):null;}catch(e){it=t[j];}st.tabs[i][j]=it||null;}});
  STASH=st;
  if(s&&s.ver!==SAVE_VER){try{if(!localStorage.getItem(STASH_KEY+'_backup_v'+s.ver))localStorage.setItem(STASH_KEY+'_backup_v'+s.ver,raw);}catch(e){}storeStash();}
}
function storeStash(){storeSafe(STASH_KEY,JSON.stringify(STASH));backupSoon();} // core.js: frees old backups when full

function openStash(){if(!G.char||G.paused||!G.inTown)return;$('stashOv').classList.remove('hidden');renderStash();setPause();stashHint();}
function closeStash(){$('stashOv').classList.add('hidden');setPause();}
function setStashTab(i){stashTab=clamp(i,0,STASH_TABS-1);renderStash();}
// ---------- filters and sorting (view only) ----------
const STASH_GROUP={weapon:'weapon',shield:'offhand',focus:'offhand',helm:'armor',body:'armor',gloves:'armor',boots:'armor',belt:'armor',ring:'jewelry',amulet:'jewelry',charm:'charm'};
const STASH_FILTERS={
  slot:[['all','All slots'],['weapon','Weapons'],['offhand','Off-hands'],['armor','Armor'],['jewelry','Rings & amulets'],['charm','Charms']],
  rar:[['all','All rarities'],['0','Normal'],['1','Magic'],['2','Rare'],['5','Set'],['3','Unique'],['4','Runebind']],
  tier:[['all','All tiers'],['1','Tier I'],['2','Tier II'],['3','Tier III'],['4','Tier IV'],['5','Tier V']],
  sort:[['none','Tab order'],['slot','Sort: slot'],['rar','Sort: rarity'],['tier','Sort: tier'],['ilvl','Sort: item level']]};
const SLOT_ORDER=['weapon','shield','focus','helm','body','gloves','boots','belt','amulet','ring','charm'],RAR_ORDER=[0,1,2,5,4,3];
let stashF={slot:'all',rar:'all',tier:'all',sock:false,sort:'none'};
const stashFiltered=()=>stashF.slot!=='all'||stashF.rar!=='all'||stashF.tier!=='all'||stashF.sock||stashF.sort!=='none';
const stashMatch=it=>(stashF.slot==='all'||STASH_GROUP[it.slot]===stashF.slot)&&(stashF.rar==='all'||it.rarity===+stashF.rar)&&(stashF.tier==='all'||it.tier===+stashF.tier)&&(!stashF.sock||it.sockets>0);
// Indexes of the open tab's items to show, in display order (all slots, empties too, when nothing is filtered or sorted).
function stashView(tab){if(!stashFiltered())return tab.map((_,i)=>i);
  const ix=tab.map((it,i)=>it&&stashMatch(it)?i:-1).filter(i=>i>=0),A=i=>tab[i];
  const key={slot:i=>SLOT_ORDER.indexOf(A(i).slot),rar:i=>-RAR_ORDER.indexOf(A(i).rarity),tier:i=>-(A(i).tier||0),ilvl:i=>-A(i).ilvl}[stashF.sort];
  if(key)ix.sort((a,b)=>key(a)-key(b)||a-b);return ix;}
function setStashFilter(k,v){stashF[k]=k==='sock'?!!v:v;renderStash();}
// ---------- taps: one tap opens the card, a double tap or a long press moves the item ----------
const STASH_DBL=300,STASH_HOLD=450,STASH_HINT_KEY='emberdeep_stashhint';
function cellTaps(el,open,move){let t=null,hold=null,held=false;
  el.onpointerdown=()=>{held=false;clearTimeout(hold);hold=setTimeout(()=>{hold=null;held=true;if(t)clearTimeout(t.id);t=null;move();},STASH_HOLD);};
  const stop=()=>{clearTimeout(hold);hold=null;};el.onpointerup=stop;el.onpointerleave=stop;el.onpointercancel=stop;
  el.oncontextmenu=e=>{if(e&&e.preventDefault)e.preventDefault();};
  el.onclick=()=>{if(held){held=false;return;}if(t){clearTimeout(t.id);t=null;move();return;}const me={};me.id=setTimeout(()=>{if(t===me){t=null;open();}},STASH_DBL);t=me;};}
function stashHint(){let seen=false;try{seen=!!localStorage.getItem(STASH_HINT_KEY);localStorage.setItem(STASH_HINT_KEY,'1');}catch(e){}
  if(!seen)toast('Tip: tap an item to inspect it','Double-tap or hold to move it straight across');}
function renderStash(){
  const c=G.char,tab=STASH.tabs[stashTab];
  $('stashTabs').innerHTML=STASH.tabs.map((t,i)=>`<div class="tab${i===stashTab?' on':''}">Tab ${i+1}<small>${t.filter(Boolean).length}/${STASH_SLOTS}</small></div>`).join('');
  [...$('stashTabs').children].forEach((el,i)=>el.onclick=()=>setStashTab(i));
  const sel=k=>`<select data-f="${k}">${STASH_FILTERS[k].map(([v,n])=>`<option value="${v}"${stashF[k]===v?' selected':''}>${n}</option>`).join('')}</select>`;
  $('stashF').innerHTML=sel('slot')+sel('rar')+sel('tier')+`<div class="btn sm${stashF.sock?' on':''}" data-f="sock">● Sockets only</div>`+sel('sort')+(stashFiltered()?`<div class="btn sm" data-f="reset">✕</div>`:'');
  $('stashF').querySelectorAll('select').forEach(el=>el.onchange=()=>setStashFilter(el.dataset.f,el.value));
  $('stashF').querySelectorAll('.btn').forEach(el=>el.onclick=()=>{if(el.dataset.f==='reset'){stashF={slot:'all',rar:'all',tier:'all',sock:false,sort:'none'};renderStash();}else setStashFilter('sock',!stashF.sock);});
  const view=stashView(tab);
  $('stashGrid').innerHTML=view.length?view.map(i=>cellHtml(tab[i])).join(''):'<p class="fdim" style="grid-column:1/-1">Nothing in this tab matches.</p>';
  [...$('stashGrid').children].forEach((el,k)=>{const i=view[k];if(i==null||!tab[i])return;cellTaps(el,()=>openStashItem(tab[i],'stash'),()=>takeFromStash(i));});
  $('stashBagN').textContent=`${c.bag.length}/${BAG_SIZE}`;
  const cells=[];for(let i=0;i<Math.max(BAG_SIZE,c.bag.length);i++)cells.push(cellHtml(c.bag[i]));$('stashBag').innerHTML=cells.join('');
  [...$('stashBag').children].forEach((el,i)=>{const it=c.bag[i];if(!it)return;cellTaps(el,()=>openStashItem(it,'bag'),()=>{const j=c.bag.indexOf(it);if(j>=0)putInStash(j);});});
}
// ---------- the item card, from the stash or the bag ----------
// The usual card (stats, comparison with what you wear), with stash buttons: Move, Equip, Lock, Close.
// Salvaging is done at the blacksmith.
function openStashItem(it,from){const c=G.char;if(!it)return;
  if(it.slot==='charm')openCharm(it,false);else openItem(it,false);
  const close=$('iClose'),row=close&&close.parentElement;if(!row)return;
  const fits=it.slot==='charm'?[]:fitsFor(c,it),multi=fits.length>1;
  row.innerHTML=`<div class="btn sm" id="sMove">${from==='stash'?'⬇ Move to bag':`⬆ Move to stash (Tab ${stashTab+1})`}</div>`+
    fits.map(sl=>`<div class="btn sm${canEquipIn(c,it,sl)?'':' dis'}" data-seq="${sl}">Equip${multi?' '+SLOT_NAME[sl]:''}</div>`).join('')+
    `<div class="btn sm" id="sLock">${it.lock?'🔓 Unlock':'🔒 Lock'}</div><div class="btn sm" id="iClose">Close</div>`;
  const done=()=>{closeItem();renderStash();};
  $('sMove').onclick=()=>{const ok=from==='stash'?takeFromStash(STASH.tabs[stashTab].indexOf(it)):putInStash(c.bag.indexOf(it));if(ok)done();};
  row.querySelectorAll('[data-seq]').forEach(b=>b.onclick=()=>{if(stashEquip(c,it,from,b.dataset.seq))done();});
  $('sLock').onclick=()=>{toggleLock(it);from==='stash'?storeStash():saveChar();openStashItem(it,from);renderStash();};
  $('iClose').onclick=closeItem;}
// Equips an item straight from the stash (or the bag); what it replaces goes to the bag.
function stashEquip(c,it,from,sl){if(!fitsFor(c,it).includes(sl)||!canEquipIn(c,it,sl))return false;
  if(from==='stash'){const tab=STASH.tabs[stashTab],i=tab.indexOf(it);if(i<0)return false;
    // the item passes through the bag; equipFromBag checks there is room for what it replaces
    c.bag.push(it);if(!equipFromBag(c,it,sl)){c.bag.pop();return false;}tab[i]=null;saveChar();storeStash();}
  else if(!equipFromBag(c,it,sl))return false;else saveChar();
  refreshStats();toast('Equipped',it.name);return true;}
// Moves save the side that gains the item first, so an interrupted save can only duplicate, never lose it.
function takeFromStash(i){
  const c=G.char,tab=STASH.tabs[stashTab],it=tab[i];if(!it)return false;
  if(c.bag.length>=BAG_SIZE){toast('Bag is full','Stash or salvage something first');return false;}
  tab[i]=null;c.bag.push(it);saveChar();storeStash();renderStash();return true;
}
function putInStash(i){
  const c=G.char,it=c.bag[i];if(!it)return false;
  const tab=STASH.tabs[stashTab],j=tab.indexOf(null);
  if(j<0){toast(`Tab ${stashTab+1} is full`,'Pick another tab');return false;}
  tab[j]=it;c.bag.splice(i,1);storeStash();saveChar();renderStash();return true;
}
tap('stashBtn',openStash);
tap('stashClose',closeStash);
