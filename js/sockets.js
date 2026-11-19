'use strict';
// Sockets, gems, runes and Runebinds.
// Items can drop with sockets (bigger items hold more). Gems (6 kinds × 5 qualities) give a different stat in a weapon,
// in armor (everything else that isn't jewelry) and in jewelry; three of a kind combine into the next quality in town.
// Runes drop rarely; socketing runes in a recipe's order into a white item with exactly that many sockets forges a
// Runebind. Gems and runes live in a per-character pouch (counts, not bag slots); the Runebind book is shared by all
// characters and reveals a recipe's runes as you find them.

// ---------- sockets ----------
const SOCKET_MAX={body:4,shield:3,helm:2,focus:2,boots:2,gloves:1,belt:1,amulet:1,ring:1};
const maxSockets=it=>it.slot==='weapon'?(is2h(it)?4:3):SOCKET_MAX[it.slot]||0;
const SOCKET_CHANCE=[0.3,0.3,0.15,0.1]; // by rarity
// 0 sockets, or 1..max with fewer sockets more likely.
function rollSockets(it){const mx=maxSockets(it);if(!mx||Math.random()>=(SOCKET_CHANCE[it.rarity]||0))return 0;
  let r=Math.random()*mx*(mx+1)/2;for(let n=1;n<=mx;n++){r-=mx-n+1;if(r<0)return n;}return 1;}
const freeSockets=it=>(it.sockets||0)-(it.socketed?it.socketed.length:0);
const hostOf=it=>it.slot==='weapon'?'w':it.slot==='ring'||it.slot==='amulet'?'j':'a';
const HOST_NAME={w:'Weapon',a:'Armor',j:'Jewelry'};

// ---------- gems and runes ----------
const GQ=['Chipped','Flawed','','Flawless','Perfect'];
const GEMS={ // [stat, value per quality] in a weapon (w), armor (a) and jewelry (j)
  ruby:{name:'Ruby',col:'#e0303a',w:['dmg',[4,7,10,14,18]],a:['life',[10,20,35,55,80]],j:['loh',[1,2,3,5,7]]},
  sapphire:{name:'Sapphire',col:'#3a7aff',w:['spell',[4,7,10,14,18]],a:['res',[5,9,14,20,28]],j:['cdr',[1,2,3,4,6]]},
  topaz:{name:'Topaz',col:'#f2c030',w:['crit',[1,1.5,2.5,3.5,5]],a:['block',[1,1.5,2,3,4]],j:['critd',[5,9,14,20,28]]},
  emerald:{name:'Emerald',col:'#2fc060',w:['aspd',[2,4,6,8,11]],a:['move',[1,2,3,4,6]],j:['aspd',[1,2,3,5,7]]},
  diamond:{name:'Diamond',col:'#dff2ff',w:['critd',[6,10,16,24,32]],a:['armor',[5,12,22,35,50]],j:['life',[6,12,20,30,45]]},
  skull:{name:'Skull',col:'#d8ccb0',w:['loh',[1,2,4,6,9]],a:['regen',[0.5,1,2,3,5]],j:['res',[4,7,11,16,22]]}
};
const GEM_KEYS=Object.keys(GEMS);
// Runes, rarest last; a rune gives the same stat in any item.
const RUNES={ash:{name:'Ash',k:'life',v:15},vel:{name:'Vel',k:'dmg',v:5},ith:{name:'Ith',k:'armor',v:15},kor:{name:'Kor',k:'crit',v:2},
  sol:{name:'Sol',k:'regen',v:2},mor:{name:'Mor',k:'loh',v:3},zen:{name:'Zen',k:'cdr',v:4},rhu:{name:'Rhu',k:'aspd',v:6},
  thal:{name:'Thal',k:'critd',v:15},vex:{name:'Vex',k:'move',v:6}};
const RUNE_KEYS=Object.keys(RUNES);
// A socketed or pouched stone: {g, q} for a gem, {r} for a rune.
const stoneName=s=>s.g?(GQ[s.q-1]?GQ[s.q-1]+' ':'')+GEMS[s.g].name:RUNES[s.r].name+' Rune';
const stoneCol=s=>s.g?GEMS[s.g].col:'#ffd36b';
function stoneStat(s,host){if(s.r)return {k:RUNES[s.r].k,v:RUNES[s.r].v};const [k,vs]=GEMS[s.g][host];return {k,v:vs[s.q-1]};}
const statText=a=>AFF[a.k].t.replace('{v}',AFF[a.k].dec?(+a.v).toFixed(1):a.v);
function stoneSvg(s){
  if(s.r)return `<svg class="icn" viewBox="0 0 32 32"><rect x="7" y="4" width="18" height="24" rx="5" fill="#5d6168" stroke="#2f3236" stroke-width="1.5"/><text x="16" y="21.5" font-size="13" text-anchor="middle" fill="#ffd36b" font-family="Georgia,serif">${RUNES[s.r].name[0]}</text></svg>`;
  const col=GEMS[s.g].col,z=7+s.q*1.7;
  if(s.g==='skull')return `<svg class="icn" viewBox="0 0 32 32"><circle cx="16" cy="${16-z*0.15}" r="${z*0.8}" fill="${col}" stroke="#5a5040" stroke-width="1.3"/><rect x="${16-z*0.45}" y="${16+z*0.45}" width="${z*0.9}" height="${z*0.5}" rx="1.5" fill="${col}" stroke="#5a5040"/><circle cx="${16-z*0.32}" cy="${16-z*0.1}" r="${z*0.2}" fill="#2a2418"/><circle cx="${16+z*0.32}" cy="${16-z*0.1}" r="${z*0.2}" fill="#2a2418"/></svg>`;
  return `<svg class="icn" viewBox="0 0 32 32"><path d="M16 ${16-z}L${16+z*0.8} ${16-z*0.25}L16 ${16+z}L${16-z*0.8} ${16-z*0.25}Z" fill="${col}" stroke="#00000088" stroke-width="1.2"/><path d="M16 ${16-z}L${16+z*0.4} ${16-z*0.25}L16 ${16+z*0.2}L${16-z*0.4} ${16-z*0.25}Z" fill="#ffffff55"/></svg>`;}

// ---------- Runebinds ----------
// type: the item type; runes: the order to socket them in (the item needs exactly that many sockets).
// bonus: [affix, multiplier] rolled at the item's level when forged; pw: unique powers it also grants.
const RUNEBINDS={
  kindle:{name:'Kindle',type:'weapon',runes:['ash','vel'],bonus:[['dmg',2],['life',1]]},
  bulwark:{name:'Bulwark',type:'shield',runes:['ith','ash'],bonus:[['armor',2],['block',1.5],['life',1.5]]},
  wayfarer:{name:'Wayfarer',type:'boots',runes:['vel','sol'],bonus:[['move',2],['regen',2]]},
  clockwork:{name:'Clockwork',type:'helm',runes:['zen','rhu'],bonus:[['cdr',2],['aspd',2]]},
  keenEdge:{name:'Keen Edge',type:'weapon',runes:['kor','vel','kor'],bonus:[['crit',2],['critd',2],['dmg',1.5]]},
  stoneskin:{name:'Stoneskin',type:'body',runes:['ith','sol','ith'],bonus:[['armor',3],['life',2],['regen',1.5]]},
  bloodpact:{name:'Bloodpact',type:'weapon',runes:['mor','ash','mor'],bonus:[['loh',3],['life',2]],pw:['lastBreath']},
  pyre:{name:'Pyre',type:'body',runes:['sol','mor','vex','ash'],bonus:[['life',2.5],['regen',2]],pw:['burnAura']},
  tempest:{name:'Tempest',type:'weapon',runes:['rhu','thal','kor','rhu'],bonus:[['aspd',2.5],['critd',2],['crit',1.5]],pw:['ouroboros']},
  cometwake:{name:'Cometwake',type:'weapon',runes:['thal','zen','vex','thal'],bonus:[['dmg',2.5],['spell',2.5],['cdr',1.5]],pw:['fireTrail']}
};
const RB_TYPE={weapon:'Weapon',shield:'Shield',boots:'Boots',helm:'Helm',body:'Body Armor'};
// Forges the item if its runes, in order, match a recipe for its type (white items with every socket filled only).
function checkRunebind(it){
  if(it.rarity!==0||it.rb||freeSockets(it)!==0||!it.socketed||!it.socketed.length)return null;
  const seq=it.socketed.map(s=>s.r||'-').join(',');
  const k=Object.keys(RUNEBINDS).find(k=>RUNEBINDS[k].type===it.slot&&RUNEBINDS[k].runes.join(',')===seq);if(!k)return null;
  const R=RUNEBINDS[k];it.rarity=4;it.rb=k;it.name=R.name;it.affs=R.bonus.map(([a,m])=>rollAff(a,it.ilvl,m));
  BOOK.made[k]=true;storeBook();toast('Runebind forged!',R.name);return k;
}

// ---------- pouch (per character: counts by stone) ----------
const stoneKey=s=>s.g?s.g+':'+s.q:'rune:'+s.r;
const keyStone=k=>{const [a,b]=k.split(':');return a==='rune'?{r:b}:{g:a,q:+b};};
const pouchOf=c=>c.pouch&&typeof c.pouch==='object'?c.pouch:(c.pouch={});
function pouchAdd(c,s,n=1){const p=pouchOf(c),k=stoneKey(s);p[k]=(p[k]||0)+n;}
function pouchTake(c,s,n=1){const p=pouchOf(c),k=stoneKey(s);if(!((p[k]||0)>=n))return false;p[k]-=n;if(p[k]<=0)delete p[k];return true;}
const pouchCount=(c,s)=>pouchOf(c)[stoneKey(s)]||0;
const pouchTotal=c=>Object.values(pouchOf(c)).reduce((a,b)=>a+b,0);

// ---------- the book (shared by all characters): runes ever found, recipes forged, set pieces found ----------
const BOOK_KEY='emberdeep_book';let BOOK={runes:{},made:{},sets:{}};
function loadBook(){try{const b=JSON.parse(localStorage.getItem(BOOK_KEY));if(b&&typeof b==='object')BOOK={runes:b.runes||{},made:b.made||{},sets:b.sets&&typeof b.sets==='object'?b.sets:{}};}catch(e){}
  if(STASH)noteSetPieces(STASH.tabs.flat());}
// Records set pieces in the book the first time any character gets one.
function noteSetPieces(items){let n=0;for(const it of items)if(setOf(it)&&!BOOK.sets[it.si]){BOOK.sets[it.si]=1;n++;}if(n)storeBook();return n;}
function noteSetPiece(it){if(noteSetPieces([it]))toast('New set piece!',`${it.name} · ${SETS[setOf(it)].name}`);}
function storeBook(){try{localStorage.setItem(BOOK_KEY,JSON.stringify(BOOK));}catch(e){}backupSoon();}
const recipeKnown=k=>!!BOOK.made[k]||RUNEBINDS[k].runes.every(r=>BOOK.runes[r]);

// ---------- drops ----------
// Gem quality rises with the act (Chipped in acts 1-2 … mostly Normal in act 5, better in the endless depths).
function rollGem(depth){const a=dropAct(depth);return {g:pick(GEM_KEYS),q:clamp(1+Math.floor((a-1)/2)+(Math.random()<0.25?1:0)+(depth>25?1:0),1,5)};}
// Each act unlocks two more runes; rarer runes are less likely.
function rollRune(depth){const mx=Math.min(RUNE_KEYS.length-1,dropAct(depth)*2-1+(depth>25?1:0));
  let r=Math.random()*(mx+1)*(mx+2)/2;for(let i=0;i<=mx;i++){r-=mx-i+1;if(r<0)return {r:RUNE_KEYS[i]};}return {r:RUNE_KEYS[0]};}
const STONE_DROP={normal:[0.04,0.006],elite:[0.2,0.04],boss:[1,0.6]}; // [gem chance, rune chance]; bosses drop 2 gems
function dropStones(e,kind){const d=G.depth,[gc,rc]=STONE_DROP[kind];
  const n=kind==='boss'?2:Math.random()<gc?1:0;for(let k=0;k<n;k++)dropStone(e.x+rand(-30,30),e.y+rand(-30,30),rollGem(d));
  if(Math.random()<rc)dropStone(e.x+rand(-20,20),e.y+rand(-20,20),rollRune(d));}
function dropStone(x,y,s){if(blockedAt(x,y,4)){x=G.p.x;y=G.p.y;}G.loot.push({x,y,gem:s,t:0});}
// Walking over a gem or rune: straight into the pouch (no bag space needed).
function pickStone(l){const c=G.char,s=l.gem;pouchAdd(c,s);l.taken=true;floatText(l.x,l.y-20,stoneName(s),stoneCol(s),false);
  if(s.r&&!BOOK.runes[s.r]){const before=Object.keys(RUNEBINDS).filter(recipeKnown);BOOK.runes[s.r]=true;storeBook();
    const now=Object.keys(RUNEBINDS).filter(k=>recipeKnown(k)&&!before.includes(k));
    toast(`New rune: ${RUNES[s.r].name}`,now.length?`Recipe revealed: ${now.map(k=>RUNEBINDS[k].name).join(', ')} 📖`:'Check the Runebind book in your 💎 pouch');}}

// ---------- socketing ----------
function insertStone(it,s){const c=G.char;if(freeSockets(it)<=0||it.rarity===4||!pouchTake(c,s))return false;
  (it.socketed||(it.socketed=[])).push({...s});checkRunebind(it);
  // a worn item that just became a Runebind you already wear elsewhere comes off (one of each Runebind)
  const sl=EQ_SLOTS.find(k=>c.equip[k]===it);
  if(it.rb&&sl&&pwClash(c,it,[sl])){const o=c.equip[pwClash(c,it,[sl])];
    if(c.bag.length<30){c.equip[sl]=null;c.bag.push(it);toast(it.name+' moved to your bag',`You already wear ${o.name}`);}
    else toast('Two '+it.name+' worn',`Take one off: only one of each Runebind works`);}
  refreshStats();saveChar();return true;}
const unsocketCost=it=>Math.round(15+it.ilvl*6);
// In town, for gold: every gem and rune goes back to the pouch (Runebinds are permanent).
function unsocket(it){const c=G.char;if(!G.inTown||it.rb||!it.socketed||!it.socketed.length)return false;const cost=unsocketCost(it);if(c.gold<cost)return false;
  c.gold-=cost;for(const s of it.socketed)pouchAdd(c,s);it.socketed=[];refreshStats();saveChar();return true;}
// Salvaging an item keeps its stones.
function returnStones(c,it){if(it.rb)return;for(const s of it.socketed||[])pouchAdd(c,s);}
// Three gems of one kind and quality become one of the next quality (town only).
function combineGems(g,q){const c=G.char;if(!G.inTown||q>=5||!pouchTake(c,{g,q},3))return false;pouchAdd(c,{g,q:q+1});saveChar();return true;}

// ---------- pouch & book UI ----------
let pouchTarget=null,pouchSel=null,pouchMat=null; // pouchTarget: {it, eq} while picking a stone for an item's socket
function openPouch(target){pouchTarget=target||null;pouchSel=null;pouchMat=null;$('pouchOv').classList.remove('hidden');renderPouch();setPause();}
function closePouch(){$('pouchOv').classList.add('hidden');const t=pouchTarget;pouchTarget=null;setPause();if(t)openItem(t.it,t.eq);}
function renderPouch(){
  const c=G.char,T=pouchTarget;
  $('pouchSub').textContent=T?`Tap a gem or rune to socket it into ${T.it.name} (${freeSockets(T.it)} free)`:G.inTown?'Tap a gem to see its stats or combine three into one.':'Gems combine 3 → 1 in town.';
  const cell=s=>{const n=pouchCount(c,s);return `<div class="cell pc${n?'':' empty'}${pouchSel&&stoneKey(pouchSel)===stoneKey(s)?' sel':''}">${stoneSvg(s)}${n?`<span class="cnt">${n}</span>`:''}</div>`;};
  const gems=[];for(const g of GEM_KEYS)for(let q=1;q<=5;q++)gems.push({g,q});
  $('pouchGems').innerHTML=gems.map(cell).join('');
  [...$('pouchGems').children].forEach((el,i)=>el.onclick=()=>pickPouch(gems[i]));
  const runes=RUNE_KEYS.map(r=>({r}));
  $('pouchRunes').innerHTML=runes.map(cell).join('');
  [...$('pouchRunes').children].forEach((el,i)=>el.onclick=()=>pickPouch(runes[i]));
  const m=matsOf(c);
  $('pouchMats').innerHTML=MAT_KEYS.map(k=>`<div class="cell pc mat${m[k]?'':' empty'}${pouchMat===k?' sel':''}" title="${MATS[k].name}"><span class="mic">${MATS[k].ic}</span><span class="cnt">${m[k]}</span></div>`).join('');
  [...$('pouchMats').children].forEach((el,i)=>el.onclick=()=>{if(pouchTarget)return;pouchMat=MAT_KEYS[i];pouchSel=null;renderPouch();});
  const s=pouchSel;let h='';
  if(pouchMat){const M=MATS[pouchMat];h=`<b>${M.ic} ${M.name}</b> <span class="fdim">× ${m[pouchMat]}</span><div>From salvaging ${M.from}</div><div class="fdim">Blacksmith: ${M.use}</div>`;}
  if(s){const n=pouchCount(c,s);h=`<b style="color:${stoneCol(s)}">${esc(stoneName(s))}</b> <span class="fdim">× ${n}</span>`;
    if(s.g)h+=['w','a','j'].map(k=>`<div>${HOST_NAME[k]}: ${esc(statText(stoneStat(s,k)))}</div>`).join('');
    else{h+=`<div>${esc(statText(stoneStat(s,'w')))} in any item</div>`;const uses=Object.keys(RUNEBINDS).filter(k=>recipeKnown(k)&&RUNEBINDS[k].runes.includes(s.r));
      if(uses.length)h+=`<div class="fdim">Used in: ${uses.map(k=>RUNEBINDS[k].name).join(', ')}</div>`;}
    if(s.g&&s.q<5)h+=`<div class="row" style="margin-top:6px"><div class="btn sm${G.inTown&&n>=3?'':' dis'}" id="combBtn">Combine 3 → ${esc(stoneName({g:s.g,q:s.q+1}))}</div></div>${G.inTown?'':'<div class="fdim">Combining works in town.</div>'}`;}
  $('pouchInfo').innerHTML=h||'<span class="fdim">Gems, runes and salvage materials go here, not in your bag.</span>';
  if($('combBtn'))$('combBtn').onclick=()=>{if(combineGems(s.g,s.q)){toast('Combined',stoneName({g:s.g,q:s.q+1}));renderPouch();}};
}
function pickPouch(s){const c=G.char;
  if(pouchTarget){if(!pouchCount(c,s))return;const t=pouchTarget;if(insertStone(t.it,s)){pouchTarget=null;$('pouchOv').classList.add('hidden');setPause();if(t.eq)renderInv();openItem(t.it,t.eq);renderInv();}return;}
  pouchSel=s;pouchMat=null;renderPouch();}
function openBook(){$('bookOv').classList.remove('hidden');renderBook();setPause();}
function closeBook(){$('bookOv').classList.add('hidden');setPause();}
let bookTab='rb';
function setBookTab(t){bookTab=t;renderBook();}
function renderBook(){
  $('bookTabs').innerHTML=[['rb','Runebinds'],['sets','Sets']].map(([k,n])=>`<div class="tab${k===bookTab?' on':''}" data-t="${k}">${n}</div>`).join('');
  $('bookTabs').querySelectorAll('[data-t]').forEach(el=>el.onclick=()=>setBookTab(el.dataset.t));
  if(bookTab==='sets')return renderSetBook();
  const known=Object.keys(RUNEBINDS).filter(recipeKnown).length,made=Object.keys(BOOK.made).length;
  $('bookSub').textContent=`${known}/10 recipes known · ${made} forged. A recipe's runes appear as you find them. Socket them in this order into a white item with exactly that many sockets.`;
  $('bookList').innerHTML=Object.entries(RUNEBINDS).map(([k,R])=>{const kn=recipeKnown(k);
    const runes=R.runes.map(r=>BOOK.runes[r]||BOOK.made[k]?`<span class="rchip">${RUNES[r].name}</span>`:'<span class="rchip q">?</span>').join('<span class="fdim">›</span>');
    const bon=R.bonus.map(([a])=>AFF[a].t.replace(/\+?\{v\}%? ?/,'')).join(', ');
    return `<div class="slot rb${kn?'':' unk'}"><div class="info"><b>${kn?esc(R.name):'Unknown Runebind'}${BOOK.made[k]?' <span class="fdim">✓ forged</span>':''}</b>
      <div class="fdim">${RB_TYPE[R.type]} · ${R.runes.length} sockets</div><div class="rrow">${runes}</div>
      ${kn?`<div>${esc(bon)}</div>${(R.pw||[]).map(p=>`<div class="ipow">✦ ${esc(UPOW[p].t)}</div>`).join('')}`:''}</div></div>`;}).join('');
}
// Sets: every set is listed; found pieces are named, missing ones are '?'. Bonuses show once a piece is found.
function renderSetBook(){const keys=Object.keys(SETS),all=Object.keys(SET_ITEMS),found=all.filter(si=>BOOK.sets[si]).length;
  $('bookSub').textContent=`${found}/${all.length} set pieces found by your characters · Wear more pieces of a set to unlock its green bonuses.`;
  $('bookList').innerHTML=keys.map(k=>{const S=SETS[k],got=S.items.filter(si=>BOOK.sets[si]),kn=got.length>0,full=got.length===S.items.length;
    const who=S.cls?CLASSES[S.cls].name:'Any class',where=S.zone?`Act ${S.zone} only`:`From Act ${S.act}`;
    const txt=l=>l.map(setStatText).map(esc).join(', ');
    return `<div class="slot rb set${kn?'':' unk'}"><div class="info"><b style="${kn?'color:#3fe05a':''}">${kn?esc(S.name):'Unknown set'}${full?' <span class="fdim">✓ complete</span>':''}</b>
      <div class="fdim">${who} · ${S.items.length} pieces · ${where}</div>
      <div class="rrow">${S.items.map(si=>BOOK.sets[si]?`<span class="rchip on">${esc(SET_ITEMS[si].name)}</span>`:`<span class="rchip q">? ${TYPES[SET_ITEMS[si].type].name}</span>`).join('')}</div>
      ${kn?(S.bonus||[]).map(([n,l])=>`<div>(${n}) ${txt(l)}</div>`).join('')+(S.full&&S.full.length?`<div style="color:#3fe05a">Full set: ${txt(S.full)}</div>`:''):''}</div></div>`;}).join('');}
tap('pouchBtn',()=>openPouch(null));
tap('pouchClose',closePouch);
tap('bookBtn',openBook);
tap('bookClose',closeBook);
