'use strict';
// Stash: a chest in town shared by every character. 3 tabs × 40 slots, saved under its own key
// (not inside a character), so deleting a character never touches it. Tap an item to move it
// between the bag and the open tab.
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
function storeStash(){try{localStorage.setItem(STASH_KEY,JSON.stringify(STASH));}catch(e){}backupSoon();}

function openStash(){if(!G.char||G.paused||!G.inTown)return;$('stashOv').classList.remove('hidden');renderStash();setPause();}
function closeStash(){$('stashOv').classList.add('hidden');setPause();}
function setStashTab(i){stashTab=clamp(i,0,STASH_TABS-1);renderStash();}
function renderStash(){
  const c=G.char,tab=STASH.tabs[stashTab];
  $('stashTabs').innerHTML=STASH.tabs.map((t,i)=>`<div class="tab${i===stashTab?' on':''}">Tab ${i+1}<small>${t.filter(Boolean).length}/${STASH_SLOTS}</small></div>`).join('');
  [...$('stashTabs').children].forEach((el,i)=>el.onclick=()=>setStashTab(i));
  $('stashGrid').innerHTML=tab.map(it=>cellHtml(it)).join('');
  [...$('stashGrid').children].forEach((el,i)=>el.onclick=()=>takeFromStash(i));
  $('stashBagN').textContent=`${c.bag.length}/${BAG_SIZE}`;
  const cells=[];for(let i=0;i<Math.max(BAG_SIZE,c.bag.length);i++)cells.push(cellHtml(c.bag[i]));$('stashBag').innerHTML=cells.join('');
  [...$('stashBag').children].forEach((el,i)=>el.onclick=()=>putInStash(i));
}
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
