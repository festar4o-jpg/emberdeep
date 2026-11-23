'use strict';
// Endgame maps (v1.0.65, inspired by PoE2's endgame). Once Hell is beaten, Sigils (map items, tiers 1-15) open one
// map each from the Map Device (the Waystone's 🗺 button): a zone built from one of the 27 zone layouts and themes,
// with random map modifiers, 1-2 champions and a map boss (a zone boss with more life and a third mechanic).
// Killing the map boss completes the map; it drops Sigils (often of the next tier) and the portal leads home.
// Strength: power depth 75 + 2 x tier (maps.js powDepth), Hell's rules otherwise (resistance penalty, loot), plus the
// modifiers. Each modifier makes the map harder and adds Item Quantity and Item Rarity. You have SIG_LIVES lives per
// map; dying with none left, or travelling anywhere but town, closes it. The town portal keeps it (portal.js).
// Sigils are crafted with the crafting currency at the Map Device. The pouch is shared by all heroes (SIG_KEY, in
// backups); the open map is per hero (c.mapRun). Phase 2 (the Atlas) chooses the map's place; for now it's random.
const SIG_KEY='emberdeep_sigils',SIG_MAX_TIER=15,SIG_LIVES=3,SIG_CAP=60;
// Map modifiers: p = a prefix (monsters) or suffix (you); v by mod tier (T1 strongest ... T3); q = Item Quantity % by tier.
const MAP_MODS={
  mlife:{p:1,t:'Monsters have {v}% more Life',v:[60,45,30],q:[14,11,8]},
  mdmg:{p:1,t:'Monsters deal {v}% more damage',v:[35,25,15],q:[14,11,8]},
  mpack:{p:1,t:'{v}% more monster packs',v:[50,35,20],q:[18,14,10]},
  melite:{p:1,t:'{v}% more champion packs',v:[120,80,50],q:[14,11,8]},
  mspeed:{p:1,t:'Monsters move and attack {v}% faster',v:[20,15,10],q:[13,10,7]},
  mfire:{p:1,t:'Monsters deal {v}% of their damage as Fire',el:'fres',v:[70,55,40],q:[12,9,6]},
  mcold:{p:1,t:'Monsters deal {v}% of their damage as Cold',el:'cres',v:[70,55,40],q:[12,9,6]},
  mlight:{p:1,t:'Monsters deal {v}% of their damage as Lightning',el:'lres',v:[70,55,40],q:[12,9,6]},
  mpois:{p:1,t:'Monsters deal {v}% of their damage as Poison',el:'pres',v:[70,55,40],q:[12,9,6]},
  pres:{p:0,t:'{v}% lower Resistances',v:[20,15,10],q:[14,11,8]},
  pregen:{p:0,t:'{v}% less Life Regeneration and Potion Healing',v:[60,45,30],q:[12,9,6]},
  parmor:{p:0,t:'{v}% less Armor',v:[40,30,20],q:[13,10,7]},
  pslow:{p:0,t:'You move {v}% slower',v:[12,8,5],q:[12,9,6]},
  pcd:{p:0,t:'Your skills recover {v}% slower',v:[20,15,10],q:[12,9,6]}
};
const MOD_KEYS=Object.keys(MAP_MODS);
const modV=m=>MAP_MODS[m.k].v[m.t-1],modQ=m=>MAP_MODS[m.k].q[m.t-1];
const modText=m=>MAP_MODS[m.k].t.replace('{v}',modV(m));
// A mod tier for a Sigil of tier T: higher Sigils roll stronger mods more often.
const rollModTier=T=>{const r=Math.random(),b=Math.min(0.5,T/30);return r<0.15+b*0.6?1:r<0.55+b*0.4?2:3;};
// Item Quantity and Rarity of a Sigil: +2% quantity per tier, plus its mods; rarity is 70% of the mods' part.
function sigQuant(s){return 2*s.tier+s.mods.reduce((a,m)=>a+modQ(m),0);}
function sigRar(s){return Math.round(s.mods.reduce((a,m)=>a+modQ(m),0)*0.7);}
const SIG_RNAME=['Plain','Magic','Rare'],SIG_COL=['#e8dcc4','#8888ff','#ffff77'];
let SIGILS=[];
const SIGILS_NOW=()=>SIGILS; // (tests: a let)
function loadSigils(){SIGILS=[];try{const a=JSON.parse(localStorage.getItem(SIG_KEY));if(Array.isArray(a))SIGILS=a.filter(validSig).slice(0,SIG_CAP);}catch(e){}}
function storeSigils(){try{localStorage.setItem(SIG_KEY,JSON.stringify(SIGILS));}catch(e){}backupSoon();}
function validSig(s){if(!s||typeof s!=='object'||!(s.tier>=1&&s.tier<=SIG_MAX_TIER))return false;s.tier=Math.floor(s.tier);s.rarity=clamp(s.rarity|0,0,2);
  s.mods=(Array.isArray(s.mods)?s.mods:[]).filter(m=>m&&MAP_MODS[m.k]&&m.t>=1&&m.t<=3);if(!s.id)s.id=++ITEM_ID;return true;}
// ---------- Sigils and their modifiers ----------
const modsPre=s=>s.mods.filter(m=>MAP_MODS[m.k].p).length,modsSuf=s=>s.mods.filter(m=>!MAP_MODS[m.k].p).length;
// Mods that can still go on (magic 1 + 1, rare 2 + 2; one of each element at most... one of each mod).
function modPool(s,rar=s.rarity){const have=new Set(s.mods.map(m=>m.k)),mp=rar<=1?1:2;
  return MOD_KEYS.filter(k=>!have.has(k)&&(MAP_MODS[k].p?modsPre(s)<mp:modsSuf(s)<mp));}
const newMod=(s,k)=>({k,t:rollModTier(s.tier)});
function addMods(s,n,rar){for(let i=0;i<n;i++){const P=modPool(s,rar);if(!P.length)break;s.mods.push(newMod(s,pick(P)));}}
function genSigil(tier,rarity){const s={id:++ITEM_ID,tier:clamp(Math.round(tier),1,SIG_MAX_TIER),rarity:rarity??(Math.random()<0.1?2:Math.random()<0.4?1:0),mods:[]};
  addMods(s,s.rarity===2?randi(3,4):s.rarity===1?randi(1,2):0,s.rarity);return s;}
const sigName=s=>`${SIG_RNAME[s.rarity]} Sigil · Tier ${s.tier}`;
function sigAdd(s){if(SIGILS.length>=SIG_CAP){toast('Sigil pouch is full',`${SIG_CAP} at most: use or salvage some`);return false;}SIGILS.push(s);storeSigils();return true;}
// Crafting a Sigil with the crafting currency (currency.js): the same names, adapted to map modifiers.
function sigCurBlock(k,s){const n=s.mods.length;
  if(k==='spark')return s.rarity===0?null:'Only plain Sigils';
  if(k==='crown')return s.rarity===1?(modPool(s,2).length?null:'No room'):'Only magic Sigils';
  if(k==='shard')return s.rarity>=1&&modPool(s).length?null:s.rarity<1?'Only magic and rare Sigils':'No free modifier slot';
  if(k==='cinder')return s.rarity===2?null:'Only rare Sigils';
  if(k==='tear')return n?null:'No modifiers';
  if(k==='ash')return n?null:'No modifiers';
  if(k==='star')return s.mods.some(m=>m.t>1)?null:'Every modifier is already at its strongest';
  return 'Not on Sigils';}
function sigUseCur(k,s){if(curCount(k)<1||sigCurBlock(k,s))return null;let msg='';
  if(k==='spark'){s.rarity=1;addMods(s,randi(1,2),1);msg='Now magic';}
  else if(k==='crown'){s.rarity=2;addMods(s,1,2);msg='Now rare';}
  else if(k==='shard'){addMods(s,1);msg='Added: '+modText(s.mods[s.mods.length-1]);}
  else if(k==='cinder'){s.mods=[];addMods(s,randi(3,4),2);msg='Modifiers rerolled';}
  else if(k==='tear'){for(const m of s.mods)m.t=rollModTier(s.tier);msg='Modifier strengths rerolled';}
  else if(k==='ash'){const m=pick(s.mods);s.mods.splice(s.mods.indexOf(m),1);if(!s.mods.length)s.rarity=0;else if(s.rarity===2&&s.mods.length<3)s.rarity=1;msg='Removed: '+modText(m);}
  else if(k==='star'){const m=pick(s.mods.filter(x=>x.t>1));m.t--;msg='Stronger: '+modText(m);}
  CUR[k]--;if(!CUR[k])delete CUR[k];storeCur();storeSigils();playSfx('rune');return msg;}
// ---------- the open map ----------
const mapsOpen=c=>!!c&&(c.diffDone||0)>=3;
const inMap=()=>!!(G.char&&G.char.mapRun&&G.zone==='map'&&!G.inTown);
const mapPD=r=>75+2*(r.sig.tier+(r.eg&&r.eg.abyss||0));
// The map's modifiers as one table {key: value}.
function mapModsOf(r){const o={};for(const m of r.sig.mods.concat(r.extra||[]))o[m.k]=Math.max(o[m.k]||0,modV(m));return o;} // corrupted nodes add r.extra
const MAPM=()=>inMap()?(G.char.mapRun.mm||(G.char.mapRun.mm=mapModsOf(G.char.mapRun))):null;
// The zone a map is built from: a main or side zone (not an act boss arena), its boss and champions random.
function mapSource(){const zs=Object.keys(ZONES).filter(z=>!ZONES[z].map&&ZONES[z].layout!=='boss'&&ZONES[z].act);return pick(zs);}
function regMapZone(r){const Z=ZONES[r.src]||ZONES.a1z1,mm=mapModsOf(r);
  const T=r.ntype&&r.ntype!=='plain'?ATLAS_TYPES[r.ntype].name+' · ':'',nm=r.sig.mods.length+(r.extra||[]).length;
  ZONES.map=Object.assign({},Z,{name:'Map: '+Z.name,sub:`${T}Tier ${r.sig.tier} · ${nm} modifier${nm===1?'':'s'}`,map:true,parent:null,side:null,next:null,gate:'boss',
    key:null,captive:null,hoard:r.ntype==='vault'?1:0,boss:r.boss,su:r.su,density:(Z.density||1.2)*(1+(mm.mpack||0)/100)*(1+(r.eg&&r.eg.strife||0)/100),elite:(Z.elite??0.2)*(1+(mm.melite||0)/100)});return ZONES.map;}
// node: the Atlas node to run it on (v1.0.66; the start node when not given).
function openMap(s,node){const c=G.char;if(!mapsOpen(c)||c.mapRun&&c.mapRun.lives>0&&!c.mapRun.done)return false;const i=SIGILS.indexOf(s);if(i<0)return false;
  const g=atlasGraph(atlasOf(c).seed);if(node==null)node=g.start;const n=g.nodes[node];if(!n||n.type==='citadel'||!nodeOpen(c,node))return false;
  SIGILS.splice(i,1);storeSigils();const zb=Object.keys(ZBOSS),su=Object.keys(SUPERU),nt=nodeType(c,node);
  c.mapRun={sig:s,src:n.src,node,ntype:nt,boss:pick(zb),su:shuffle(su.slice()).slice(0,randi(1,2)),lives:mapLives(c),done:false,town:G.inTown?G.depth:c.depth<=25?c.depth:25};
  if(nt==='shrine')c.mapRun.shrine=pick(Object.keys(SHRINES));
  {const L=engsFor(c,node);if(L.length){const o=engEffects(L);c.mapRun.eg=o;c.mapRun.lives+=o.life;if(o.champ)c.mapRun.su=c.mapRun.su.concat(shuffle(su.filter(x=>!c.mapRun.su.includes(x))).slice(0,o.champ));useEngs(c,L);}} // Beacons' Engravings
  if(nt==='corrupted'){const have=new Set(s.mods.map(m=>m.k));c.mapRun.extra=shuffle(MOD_KEYS.filter(k=>!have.has(k))).slice(0,2).map(k=>({k,t:2}));}
  regMapZone(c.mapRun);if(c.zst)delete c.zst.map;closeMapDevice();startZone('map','fresh');playSfx('portal');return true;}
// Leaving: complete (portal after the boss), failed (no lives left) or abandoned (travel elsewhere).
function endMap(why){const c=G.char,r=c&&c.mapRun;if(!r)return;if(r.shrine&&G.p&&G.p.shr)G.p.shr[r.shrine]=0;c.mapRun=null;if(c.tp&&c.tp.zid==='map')c.tp=null;if(INST.z.map){delete INST.z.map;instStore();}
  if(why==='fail')toast('The map collapses','No lives left: the Sigil is lost');else if(why==='abandon')toast('Your map closed','You travelled away from it');saveChar();return r;}
function mapLeave(){const c=G.char,town=c.mapRun?c.mapRun.town:25;endMap('done');startTown(town);}
// Map boss down: the map is complete; Sigils drop (often a tier up), the portal home opens (zones.js zoneBossDown).
function mapComplete(e){const c=G.char,r=c.mapRun;if(!r||r.done)return;r.done=true;const M=c.maps||(c.maps={done:0,best:0});M.done++;M.best=Math.max(M.best,r.sig.tier);
  const at=(dx=40)=>[e.x+rand(-dx,dx),e.y+rand(-dx,dx)],boss=r.ntype==='boss';
  const eg=r.eg||{},n=1+(Math.random()<0.4?1:0)+(atl(c,'s5')?1:0)+(boss?1:0)+(eg.hunt?1:0);for(let i=0;i<n;i++){const t=r.sig.tier+(Math.random()<0.35+(atl(c,'s2')?0.15:0)+(eg.asc||0)/100?1:Math.random()<0.25?-1:0);dropSigil(...at(),genSigil(t,atl(c,'s3')?(Math.random()<0.2?2:Math.random()<0.6?1:0):undefined));}
  // the Atlas tree's Bosses branch, and Boss nodes
  const item=(b,min)=>dropItem(...at(50),rollDrop(c,PD()+2,b,min,{act:5}));
  if(atl(c,'b1'))item(2,0);if(atl(c,'b4'))item(2,2);if(boss){for(let i=0;i<2+(atl(c,'b3')?2:0);i++)item(3,2);dropCurrency(e,'boss');}
  if(eg.hunt)for(let i=0;i<eg.hunt;i++)item(3,2);
  // Engravings: boss nodes always, Beacons' first clear always, other map bosses 15%
  {const firstB=r.node!=null&&isBeacon(c,r.node)&&!(beaconsOf(c)[r.node]&&beaconsOf(c)[r.node].lit);if(boss||firstB||Math.random()<0.15){const [x,y]=at();G.loot.push({x,y,eng:genEng(),t:0});}}
  if(atl(c,'b2'))dropCurrency(e,'chest');if(atl(c,'b5')){const cats=CUR_KEYS.filter(k=>CURS[k].cat),[x,y]=at();G.loot.push({x,y,cur:pick(cats),t:0});}
  // the Atlas: the node is done (its neighbours show), points for new special nodes and every 4 new plain ones
  let pt='';if(r.node!=null){const A=atlasOf(c),first=!A.done[r.node];A.done[r.node]=(A.done[r.node]||0)+1;
    if(isBeacon(c,r.node)){const B=beaconsOf(c);if(!B[r.node]||!B[r.node].lit){B[r.node]={lit:1,eng:null};A.pts++;pt=' · Beacon lit, +1 Atlas point';}}
    else if(first){if(r.ntype&&r.ntype!=='plain'){A.pts++;pt=' · +1 Atlas point';}else{A.plain++;if(A.plain%4===0){A.pts++;pt=' · +1 Atlas point';}}}}
  toast('Map complete!',`Tier ${r.sig.tier} · ${M.done} maps done${pt} · the portal leads home`);playSfx('levelup');saveChar();}
// ---------- Sigil drops ----------
function dropSigil(x,y,s){if(blockedAt(x,y,4)){x=G.p.x;y=G.p.y;}G.loot.push({x,y,sig:s,t:0});playSfx('rune');}
// From kills: maps (champions more), Hell act bosses and the endless depths once maps are open.
function sigilDrops(e,kind){const c=G.char;if(!mapsOpen(c))return;
  if(inMap()&&kind==='su'&&Math.random()<0.04)G.loot.push({x:e.x+rand(-20,20),y:e.y+rand(-20,20),eng:genEng(),t:0});
  if(inMap()){const ch=(kind==='elite'||kind==='su'?0.04:kind==='normal'?0.004:0)*(1+(atl(c,'s1')?0.15:0)+(atl(c,'s4')?0.25:0));if(Math.random()<ch)dropSigil(e.x,e.y,genSigil(c.mapRun.sig.tier));return;}
  if(kind!=='boss'&&kind!=='zboss')return;const hell=(G.depth||1)<=25&&diffHere()===2,endless=(G.depth||1)>25;
  if((hell||endless)&&Math.random()<(kind==='boss'?0.35:0.15))dropSigil(e.x,e.y,genSigil(endless?randi(1,3):1));}
function pickSigil(l){if(!sigAdd(l.sig))return;l.taken=true;floatText(l.x,l.y-20,sigName(l.sig),SIG_COL[l.sig.rarity],false);playSfx('pickup');}
function drawSigilLoot(l,bob){const s=l.sig,x=l.x,y=l.y+bob,col=SIG_COL[s.rarity];softShadow(x,y+8,9,3,0.8);
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(-9,-9,18,18);ctx.strokeStyle=col;ctx.lineWidth=1.6;ctx.strokeRect(-9,-9,18,18);ctx.restore();
  ctx.fillStyle=col;ctx.font='bold 10px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s.tier,x,y+0.5);ctx.textBaseline='alphabetic';
  lootLabel(x,y-17,sigName(s),col,col,null,null,true);}
// ---------- what modifiers do (hooks from monsters.js, items.js, zones.js) ----------
// A monster made in a map: more life, damage, speed, and elemental damage from the element mods.
function mapEnemy(e){const M=MAPM();if(!M)return;e.hp*=1+(M.mlife||0)/100;e.maxHp=e.hp;e.dmg*=1+(M.mdmg||0)/100;
  if(M.mspeed){e.spd*=1+M.mspeed/100;e.cdMul=(e.cdMul||1)/(1+M.mspeed/100);}
  const els=MOD_KEYS.filter(k=>MAP_MODS[k].el&&M[k]);if(els.length){const k=pick(els);e.elem=MAP_MODS[k].el;e.elemS=Math.max(e.elemS&&e.elem===MAP_MODS[k].el?e.elemS:0,M[k]/100);}}
// Your stats in a map: the suffix mods (calcStats calls this last).
function mapStats(s){const M=MAPM();if(!M)return;if(M.pregen){s.regen*=1-M.pregen/100;s.potheal=(s.potheal||0)-M.pregen;}if(M.parmor)s.armor*=1-M.parmor/100;
  if(M.pslow)s.move-=M.pslow;if(M.pcd)s.cdr-=M.pcd;}
const mapResPen=()=>{const M=MAPM();return M&&M.pres||0;};
// Loot in a map: Hell's, with the Sigil's Item Quantity (items, charms, currency) and Item Rarity on top.
function mapLoot(){const c=G.char,r=c.mapRun,L=DIFFS[2].loot,QR=runQR(c,r),q=1+QR.q/100,cm=1+(atl(c,'r3')?0.2:0)+(atl(c,'r5')?0.3:0)+(r.eg?r.eg.cur/100:0);return Object.assign({},L,{drop:L.drop*q,cur:L.cur*q*cm,rar:L.rar+QR.r,pity:100});}
// ---------- the Map Device window (from the Waystone) ----------
let mapSel=null;
function openMapDevice(){const c=G.char;if(!mapsOpen(c))return;mapSel=null;$('mapOv').classList.remove('hidden');renderMapDevice();setPause();}
function closeMapDevice(){$('mapOv').classList.add('hidden');setPause();}
function renderMapDevice(){const c=G.char,r=c.mapRun,M=c.maps||{done:0,best:0};
  $('mapTabs').innerHTML=[['atlas','Atlas'],['sigils','Sigils'],['eng',`Engravings (${ENGS.length})`],['tree',`Atlas tree${treeFree(c)>0?' ('+treeFree(c)+')':''}`]].map(([k,n])=>`<div class="tab${mapTab===k?' on':''}" data-mt="${k}">${n}</div>`).join('');
  $('mapTabs').querySelectorAll('[data-mt]').forEach(el=>el.onclick=()=>setMapTab(el.dataset.mt));
  const open=r&&r.lives>0?`<div class="pinfo"><b>Open map:</b> ${esc(ZONES.map?ZONES.map.name:'')} · Tier ${r.sig.tier} · ${'♥'.repeat(r.lives)} ${r.done?'(complete)':''}<div class="row"><div class="btn sm" id="mapBack">Return to it</div><div class="btn sm red" id="mapQuit">Abandon</div></div></div>`:'';
  $('mapSub').innerHTML=`${M.done} maps done · best Tier ${M.best||'–'} · ${SIGILS.length}/${SIG_CAP} Sigils (shared by your heroes). Each map: ${mapLives(c)} lives.`;
  if(mapTab==='atlas'||mapTab==='tree'||mapTab==='eng'){$('mapList').innerHTML=open+(mapTab==='atlas'?renderAtlas():mapTab==='eng'?renderEngs():renderTree());$('mapInfo').innerHTML='';$('mapInfo').style.display='none';
    $('mapList').querySelectorAll('[data-n]').forEach(el=>el.onclick=()=>{atlasSel=+el.dataset.n;const sc=$('mapList').querySelector('.atlasview'),st=sc?sc.scrollLeft:0,tp=sc?sc.scrollTop:0;renderMapDevice();const s2=$('mapList').querySelector('.atlasview');if(s2){s2.scrollLeft=st;s2.scrollTop=tp;}});
    $('mapList').querySelectorAll('[data-pick]').forEach(el=>el.onclick=()=>{mapSel=SIGILS[+el.dataset.pick];renderMapDevice();});
    if($('atlasGo'))$('atlasGo').onclick=()=>{if(!mapSel||!openMap(mapSel,atlasSel))toast('Can\'t open it','Finish or abandon your open map first');};
    $('mapList').querySelectorAll('[data-eng]').forEach(el=>el.onclick=()=>{if(placeEng(c,atlasSel,ENGS[+el.dataset.eng])){toast('Engraving placed','It changes the maps around this Beacon');renderMapDevice();}});
    if($('engTake'))$('engTake').onclick=()=>{if(takeEng(c,atlasSel))renderMapDevice();};
    $('mapList').querySelectorAll('[data-t]').forEach(el=>el.onclick=()=>{if(treeTake(c,el.dataset.t)){toast('Atlas tree',ATLAS_TREE.find(x=>x.id===el.dataset.t).name);renderMapDevice();}});
    if($('mapBack'))$('mapBack').onclick=()=>{closeMapDevice();closeWay();regMapZone(r);startZone('map',hasInstance('map')?'tp':'fresh');};
    if($('mapQuit'))$('mapQuit').onclick=()=>{endMap('abandon');renderMapDevice();};
    if(mapTab==='atlas'&&atlasSel==null){const v=$('mapList').querySelector('.atlasview'),g=atlasGraph(atlasOf(c).seed),st=g.nodes[g.start];if(v&&v.clientWidth){v.scrollLeft=st.x-v.clientWidth/2;v.scrollTop=st.y-v.clientHeight/2;}}
    return;}
  $('mapInfo').style.display='';
  const list=SIGILS.slice().sort((a,b)=>b.tier-a.tier||b.rarity-a.rarity);
  $('mapList').innerHTML=open+(list.length?list.map(s=>`<div class="slot${mapSel===s?' cur-ok':''}" data-sig="${SIGILS.indexOf(s)}"><div class="ic" style="color:${SIG_COL[s.rarity]}">◆<small>${s.tier}</small></div><div class="info"><b style="color:${SIG_COL[s.rarity]}">${sigName(s)}</b> <span class="fdim">+${sigQuant(s)}% quantity · +${sigRar(s)}% rarity</span>${s.mods.map(m=>`<div class="smod ${MAP_MODS[m.k].p?'mp':'ms'}">${esc(modText(m))} <span class="fdim">(T${m.t})</span></div>`).join('')}</div></div>`).join(''):'<p class="fdim">No Sigils yet. Hell act bosses and zone bosses, the Endless Depths and maps drop them.</p>');
  const s=mapSel;let h='';
  if(s){h=`<b style="color:${SIG_COL[s.rarity]}">${sigName(s)}</b> <span class="fdim">power like depth ${75+2*s.tier} · area level ${areaLvl(75+2*s.tier)}</span>
    <div class="row" style="margin-top:4px">${CUR_KEYS.filter(k=>!CURS[k].cat&&!['awl','spindle','whet'].includes(k)).map(k=>{const why=curCount(k)<1?'none':sigCurBlock(k,s);return `<div class="btn sm${why?' dis':''}" data-sc="${k}" title="${esc(why||CURS[k].name)}"><span style="color:${CURS[k].col}">${CURS[k].ic}</span> ×${curCount(k)}</div>`;}).join('')}</div>
    <div class="row"><div class="btn sm" id="mapGo">🗺 Pick a node on the Atlas</div><div class="btn sm red" id="mapSalv">Discard</div></div>`;}
  $('mapInfo').innerHTML=h||'<span class="fdim">Tap a Sigil to craft it or open its map. Modifiers make a map harder and add Item Quantity and Rarity.</span>';
  $('mapList').querySelectorAll('[data-sig]').forEach(el=>el.onclick=()=>{mapSel=SIGILS[+el.dataset.sig];renderMapDevice();});
  $('mapInfo').querySelectorAll('[data-sc]').forEach(el=>el.onclick=()=>{const msg=sigUseCur(el.dataset.sc,s);if(msg)toast(CURS[el.dataset.sc].name,msg);renderMapDevice();});
  if($('mapGo'))$('mapGo').onclick=()=>setMapTab('atlas');
  if($('mapSalv'))$('mapSalv').onclick=()=>{const i=SIGILS.indexOf(s);if(i>=0){SIGILS.splice(i,1);storeSigils();mapSel=null;renderMapDevice();}};
  if($('mapBack'))$('mapBack').onclick=()=>{closeMapDevice();closeWay();regMapZone(r);startZone('map',hasInstance('map')?'tp':'fresh');};
  if($('mapQuit'))$('mapQuit').onclick=()=>{endMap('abandon');renderMapDevice();};}
tap('mapClose',closeMapDevice);
// ---------- the Atlas (v1.0.66) ----------
// A map of 60 nodes per hero (c.atlas, its layout from a seed). Each node is one of the 27 zones' layouts and themes.
// You start in the middle; completing a node's map reveals its neighbours. A Sigil can be run on any revealed node.
// Special nodes (their bonus once, the first time): Shrine (a shrine's blessing for the whole map), Vault (a hoard
// chest, +50% Quantity and Rarity), Boss (a far tougher map boss with much more loot), Corrupted (two extra
// modifiers, double Quantity and Rarity). Three Citadels lie at the far edges (sealed for now: their guardians come
// with the pinnacle boss). Atlas points: one for each special node's first clear, one for every 4 new plain nodes,
// spent on the Atlas tree (ATLAS_TREE).
const ATLAS_N=[10,6],ATLAS_SP=130,ATLAS_TYPES={plain:{name:'Map',col:'#b8a888'},shrine:{name:'Shrine',col:'#7ad8ff',t:"A shrine's blessing lasts the whole map"},
  vault:{name:'Vault',col:'#f2d04a',t:'A hoard chest; +50% Item Quantity and Rarity'},boss:{name:'Boss',col:'#ff5a3a',t:'A far tougher map boss, with much more loot'},
  corrupted:{name:'Corrupted',col:'#c050ff',t:'Two extra modifiers; double Item Quantity and Rarity'},citadel:{name:'Citadel',col:'#ffffff',t:'Sealed. Its guardian waits for the Hollow Sun to rise.'}};
const ATLAS_CACHE={};
function atlasGraph(seed){if(ATLAS_CACHE[seed])return ATLAS_CACHE[seed];const R=artRng(seed),N=[],[W,H]=ATLAS_N,zs=Object.keys(ZONES).filter(z=>!ZONES[z].map&&ZONES[z].layout!=='boss'&&ZONES[z].act).sort();
  for(let j=0;j<H;j++)for(let i=0;i<W;i++)N.push({id:N.length,x:70+i*ATLAS_SP+(j%2)*ATLAS_SP*0.5+(R()-0.5)*60,y:60+j*ATLAS_SP*0.78+(R()-0.5)*44,type:'plain',src:zs[Math.floor(R()*zs.length)],nb:[]});
  const cx=70+(W-0.5)*ATLAS_SP/2,cy=60+(H-1)*ATLAS_SP*0.39,d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2,link=(a,b)=>{if(a!==b&&!a.nb.includes(b.id)){a.nb.push(b.id);b.nb.push(a.id);}};
  const start=N.slice().sort((a,b)=>((a.x-cx)**2+(a.y-cy)**2)-((b.x-cx)**2+(b.y-cy)**2))[0];
  for(const a of N)N.filter(b=>b!==a).sort((p,q)=>d2(a,p)-d2(a,q)).slice(0,2+(R()<0.5?1:0)).forEach(b=>{if(d2(a,b)<200*200)link(a,b);});
  // everything reachable from the start, and each node's distance (steps) from it
  for(;;){const dist=new Map([[start.id,0]]),q=[start];while(q.length){const a=q.shift();for(const b of a.nb)if(!dist.has(b)){dist.set(b,dist.get(a.id)+1);q.push(N[b]);}}
    const out=N.filter(a=>!dist.has(a.id));if(!out.length){for(const a of N)a.d=dist.get(a.id);break;}
    const a=out[0],b=N.filter(x=>dist.has(x.id)).sort((p,q)=>d2(a,p)-d2(a,q))[0];link(a,b);}
  // the three Citadels: the farthest nodes in three directions; then the special nodes
  const ang=a=>Math.atan2(a.y-cy,a.x-cx);for(let k=0;k<3;k++){const lo=-Math.PI+k*2*Math.PI/3,hi=lo+2*Math.PI/3,c=N.filter(a=>a.type==='plain'&&ang(a)>=lo&&ang(a)<hi).sort((p,q)=>q.d-p.d)[0];if(c)c.type='citadel';}
  const free=()=>N.filter(a=>a.type==='plain'&&a!==start&&a.d>=1);for(const [t,n] of [['shrine',7],['vault',7],['boss',6],['corrupted',5]])for(let i=0;i<n;i++){const f=free();if(!f.length)break;f[Math.floor(R()*f.length)].type=t;}
  start.start=true;const G2={nodes:N,start:start.id,w:70*2+(W+0.5)*ATLAS_SP,h:60*2+(H-1)*ATLAS_SP*0.78};ATLAS_CACHE[seed]=G2;return G2;}
const atlasOf=c=>{const A=c.atlas&&typeof c.atlas==='object'?c.atlas:(c.atlas={});if(!(A.seed>0))A.seed=1+Math.floor(Math.random()*1e9);
  if(!A.done||typeof A.done!=='object')A.done={};if(!(A.pts>=0))A.pts=0;if(!A.tree||typeof A.tree!=='object')A.tree={};if(!(A.plain>=0))A.plain=0;return A;};
const nodeDone=(c,id)=>!!atlasOf(c).done[id];
// Revealed: the start, every completed node and their neighbours.
function nodeOpen(c,id){const A=atlasOf(c),g=atlasGraph(A.seed),n=g.nodes[id];if(!n)return false;if(n.start||A.done[id])return true;return n.nb.some(b=>A.done[b]||g.nodes[b].start);}
// A node's special bonus only counts the first time.
const nodeType=(c,id)=>{const n=atlasGraph(atlasOf(c).seed).nodes[id];return n&&!nodeDone(c,id)?n.type:'plain';};
// ---------- the Atlas tree ----------
const ATLAS_TREE=[
  {id:'s1',br:'Sigils',name:'Sigil Seekers',t:'+15% Sigil drops in maps'},{id:'s2',br:'Sigils',name:'Ascending Path',t:'Sigils from map bosses: 15% more often a tier higher'},
  {id:'s3',br:'Sigils',name:'Inscribed',t:'Dropped Sigils are more often magic or rare'},{id:'s4',br:'Sigils',name:'Sigil Hoard',t:'+25% Sigil drops in maps'},
  {id:'s5',br:'Sigils',name:'Twin Sigils',t:'Map bosses drop one more Sigil'},
  {id:'r1',br:'Riches',name:'Plunder',t:'+6% Item Quantity in maps'},{id:'r2',br:'Riches',name:'Gilded Halls',t:'+10% Item Rarity in maps'},
  {id:'r3',br:'Riches',name:'Currency Hunter',t:'+20% crafting currency in maps'},{id:'r4',br:'Riches',name:'Plenty',t:'+8% Item Quantity in maps'},
  {id:'r5',br:'Riches',name:'Starfall',t:'+30% crafting currency in maps'},
  {id:'d1',br:'Danger',name:'Thrill Seeker',t:'Map modifiers give 15% more Quantity and Rarity'},{id:'d2',br:'Danger',name:'Second Wind',t:'+1 life in every map'},
  {id:'d3',br:'Danger',name:'Feeding Rot',t:'Corrupted nodes give 50% more Quantity and Rarity'},{id:'d4',br:'Danger',name:'Deeper Thrill',t:'Map modifiers give 25% more Quantity and Rarity'},
  {id:'d5',br:'Danger',name:'Unbroken',t:'+1 life in every map'},
  {id:'b1',br:'Bosses',name:'Trophy Hunter',t:'Map bosses drop one more item'},{id:'b2',br:'Bosses',name:'Bounty',t:'Map bosses drop one more crafting currency'},
  {id:'b3',br:'Bosses',name:"Hunter's Mark",t:'Boss nodes: two more rare items'},{id:'b4',br:'Bosses',name:'Spoils',t:'Map bosses drop one more item, rare or better'},
  {id:'b5',br:'Bosses',name:'Catalyst Vein',t:'Map bosses always drop a catalyst'}];
const ATL_BR=['Sigils','Riches','Danger','Bosses'];
const atl=(c,id)=>!!(c&&atlasOf(c).tree[id]);
const treeSpent=c=>Object.keys(atlasOf(c).tree).length;
const treeFree=c=>atlasOf(c).pts-treeSpent(c);
// A passive needs the one before it in its branch.
function treeCan(c,id){const i=ATLAS_TREE.findIndex(x=>x.id===id),n=ATLAS_TREE[i];if(!n||atl(c,id)||treeFree(c)<1)return false;const prev=ATLAS_TREE[i-1];return !prev||prev.br!==n.br||atl(c,prev.id);}
function treeTake(c,id){if(!treeCan(c,id))return false;atlasOf(c).tree[id]=1;saveChar();return true;}
// Map lives with the tree.
const mapLives=c=>SIG_LIVES+(atl(c,'d2')?1:0)+(atl(c,'d5')?1:0);
// A run's Item Quantity / Rarity: the Sigil's tier and modifiers (the tree's Danger branch on the modifiers), extra
// corrupted modifiers, the node's bonus, and the tree's Riches branch.
function runQR(c,r){const s=r.sig,mods=s.mods.concat(r.extra||[]),mq=mods.reduce((a,m)=>a+modQ(m),0)*(1+(atl(c,'d1')?0.15:0)+(atl(c,'d4')?0.25:0));
  let q=2*s.tier+mq,ra=mq*0.7;if(r.ntype==='vault'){q+=50;ra+=50;}if(r.ntype==='corrupted'){const k=atl(c,'d3')?2.5:2;q*=k;ra*=k;}
  q+=(atl(c,'r1')?6:0)+(atl(c,'r4')?8:0);ra+=atl(c,'r2')?10:0;if(r.eg){q+=r.eg.qty;ra+=r.eg.rar;}return {q:Math.round(q),r:Math.round(ra)};}
// ---------- node bonuses during the run ----------
function mapTick(){const c=G.char,r=c.mapRun;if(!r||!r.shrine||!G.p)return;const b=G.p.shr||(G.p.shr={});if(!(b[r.shrine]>9000)){b[r.shrine]=99999;refreshStats();}}
// The Atlas window: the map of nodes, the selected node, and the Sigil to run there.
let atlasSel=null,mapTab='atlas';
function setMapTab(t){mapTab=t;renderMapDevice();}
function renderAtlas(){const c=G.char,A=atlasOf(c),g=atlasGraph(A.seed),N=g.nodes,vis=N.filter(n=>nodeOpen(c,n.id));
  const vset=new Set(vis.map(n=>n.id));let lines='';for(const a of vis)for(const b of a.nb)if(b>a.id&&vset.has(b)){const o=N[b];lines+=`<line x1="${a.x|0}" y1="${a.y|0}" x2="${o.x|0}" y2="${o.y|0}" class="aedge${A.done[a.id]&&A.done[b]?' done':''}"/>`;}
  const BE=new Set(atlasBeacons(A.seed)),BS=beaconsOf(c),rng=atlasSel!=null&&BE.has(atlasSel)?new Set(N.filter(x=>nodeSteps(g,atlasSel,x.id,BEACON_R)<=BEACON_R).map(x=>x.id)):null;
  const dots=vis.map(n=>{const done=A.done[n.id],bc=BE.has(n.id),T=bc?{name:'Beacon',col:'#5ae0c0'}:ATLAS_TYPES[n.type],col=done&&n.type!=='citadel'&&!bc?'#6a8a5a':T.col,r=n.type==='citadel'?15:n.start?13:11;
    return `<g class="anode${atlasSel===n.id?' sel':''}" data-n="${n.id}">${rng&&rng.has(n.id)?`<circle cx="${n.x|0}" cy="${n.y|0}" r="${r+6}" fill="none" stroke="#5ae0c0" stroke-opacity=".35" stroke-width="3"/>`:''}${bc&&BS[n.id]&&BS[n.id].eng?`<circle cx="${n.x|0}" cy="${n.y|0}" r="${r+3}" fill="none" stroke="${ENG[BS[n.id].eng.k].col}" stroke-width="2" stroke-dasharray="3 3"/>`:''}<circle cx="${n.x|0}" cy="${n.y|0}" r="${r}" fill="${done?'#1c2a18':'#120e0a'}" stroke="${col}" stroke-width="${atlasSel===n.id?4:2}"/>`+
      `<text x="${n.x|0}" y="${(n.y|0)+4}" text-anchor="middle" fill="${col}" font-size="11">${n.type==='citadel'?'♜':n.start?'⌂':bc?'▲':done?'✓':n.type==='plain'?'':T.name[0]}</text></g>`;}).join('');
  const sv=`<div class="atlasview"><svg width="${g.w|0}" height="${g.h|0}" viewBox="0 0 ${g.w|0} ${g.h|0}">${lines}${dots}</svg></div>`;
  const n=atlasSel!=null?N[atlasSel]:null;let info='';
  if(n){const Z=ZONES[n.src],t=nodeType(c,n.id),bc=BE.has(n.id),T=bc?{name:'Beacon',col:'#5ae0c0',t:'Clear it to light it; a lit Beacon holds an Engraving that changes every map within 2 steps'}:ATLAS_TYPES[n.type];
    info=`<b style="color:${T.col}">${T.name}${n.type==='citadel'?'':': '+esc(Z.name)}</b> <span class="fdim">${A.done[n.id]?'· done '+A.done[n.id]+'×':''}${n.start?' · the start':''}</span>${T.t?`<div class="fdim">${esc(T.t)}${t!==n.type&&n.type!=='citadel'?' (used up)':''}</div>`:''}`;
    if(bc){const st=BS[n.id];if(st&&st.lit){info+=st.eng?`<div style="color:${ENG[st.eng.k].col}">${esc(ENG[st.eng.k].name)}: ${esc(engText(st.eng))} <span class="fdim">(${st.eng.uses} maps left)</span></div><div class="row"><div class="btn sm" id="engTake">Take it out</div></div>`
        :`<div class="fdim">Lit: place an Engraving</div><div class="row">${ENGS.map((e,i)=>`<div class="btn sm" data-eng="${i}" style="color:${ENG[e.k].col}" title="${esc(engText(e))}">${esc(ENG[e.k].name.replace('Engraving of ',''))} ·${e.uses}</div>`).join('')||'<span class="fdim">No Engravings: map bosses drop them</span>'}</div>`;}
      else info+='<div class="fdim">Not lit yet: clear its map</div>';}
    {const L=engsFor(c,n.id);if(L.length)info+=`<div class="fdim">Engravings here: ${L.map(({e})=>`<span style="color:${ENG[e.k].col}">${esc(ENG[e.k].name.replace('Engraving of ',''))}</span>`).join(', ')}</div>`;}
    if(n.type!=='citadel'){const sel=mapSel&&SIGILS.includes(mapSel)?mapSel:null,list=SIGILS.slice().sort((a,b)=>b.tier-a.tier||b.rarity-a.rarity).slice(0,12);
      info+=`<div class="row" style="margin-top:4px">${list.map(s=>`<div class="btn sm${s===sel?' on':''}" data-pick="${SIGILS.indexOf(s)}" style="color:${SIG_COL[s.rarity]}">◆T${s.tier}${s.mods.length?' ·'+s.mods.length:''}</div>`).join('')||'<span class="fdim">No Sigils</span>'}</div>`+
        `<div class="row"><div class="btn sm${sel?'':' dis'}" id="atlasGo">🗺 Run ${sel?sigName(sel):'(pick a Sigil)'}</div></div>`;}}
  return sv+`<div class="pinfo">${info||'<span class="fdim">Tap a node. Completing a map reveals the nodes next to it.</span>'}</div>`;}
function renderTree(){const c=G.char,A=atlasOf(c);
  return `<p class="sub">Atlas points: <b>${treeFree(c)}</b> free of ${A.pts} · one for each special node's first clear, one per 4 new plain nodes</p>`+
    ATL_BR.map(br=>`<div class="wayrow"><div class="wayn">${br}</div><div class="wayb">${ATLAS_TREE.filter(x=>x.br===br).map(x=>`<div class="btn sm${atl(c,x.id)?' on':treeCan(c,x.id)?'':' dis'}" data-t="${x.id}" title="${esc(x.t)}">${atl(c,x.id)?'✓ ':''}${esc(x.name)}<small style="display:block;font-size:10px;opacity:.8">${esc(x.t)}</small></div>`).join('')}</div></div>`).join('');}
// ---------- Beacons and Engravings (v1.0.67, PoE2's towers and tablets) ----------
// Six plain nodes on every Atlas are Beacons (picked from the hero's Atlas seed, at least 3 steps apart). Clearing a
// Beacon's map lights it (and gives an Atlas point); a lit Beacon holds one Engraving, which changes every map run on
// the nodes within 2 steps of it, for a number of maps (its uses; one per map opened in range). Engravings drop from
// map bosses (Boss nodes and first Beacon clears always), champions in maps rarely; they live in a pouch shared by
// all heroes (ENG_KEY). One Engraving kind plus one bonus each.
const ENG_KEY='emberdeep_engravings',ENG_CAP=30,BEACON_N=6,BEACON_R=2;
const ENG={
  plenty:{name:'Engraving of Plenty',col:'#f2d04a',t:'+{v}% Item Quantity',v:[20,35]},
  champions:{name:'Engraving of Champions',col:'#ff9a5a',t:'+{v} champion pack(s)',v:[1,2]},
  hunt:{name:'Engraving of the Hunt',col:'#ff5a3a',t:'Map bosses: +50% life, +1 Sigil and +{v} rare item(s)',v:[1,2]},
  riches:{name:'Engraving of Riches',col:'#7fe0ff',t:'+{v}% crafting currency',v:[40,70]},
  ascension:{name:'Engraving of Ascension',col:'#c8a0ff',t:'Dropped Sigils: +{v}% chance to be a tier higher',v:[20,35]},
  strife:{name:'Engraving of Strife',col:'#e07a5a',t:'+{v}% monster packs, and as much Item Quantity',v:[25,45]},
  abyss:{name:'Engraving of the Abyss',col:'#9a6aff',t:'Maps count as {v} tier(s) higher: stronger monsters, +15% Quantity per tier',v:[1,1]}
};
const ENG_BONUS={rar:{t:'+{v}% Item Rarity',v:[10,25]},qty:{t:'+{v}% Item Quantity',v:[6,14]},life:{t:'+{v} life per map',v:[1,1]},cur:{t:'+{v}% crafting currency',v:[15,30]}};
const ENG_KEYS=Object.keys(ENG);
let ENGS=[];
const ENGS_NOW=()=>ENGS;
function loadEngs(){ENGS=[];try{const a=JSON.parse(localStorage.getItem(ENG_KEY));if(Array.isArray(a))ENGS=a.filter(validEng).slice(0,ENG_CAP);}catch(e){}}
function storeEngs(){try{localStorage.setItem(ENG_KEY,JSON.stringify(ENGS));}catch(e){}backupSoon();}
function validEng(e){return !!e&&typeof e==='object'&&!!ENG[e.k]&&e.uses>0&&(!e.b||!!ENG_BONUS[e.b]);}
function genEng(){const k=pick(ENG_KEYS),b=pick(Object.keys(ENG_BONUS));return {id:++ITEM_ID,k,v:randi(...ENG[k].v),b,bv:randi(...ENG_BONUS[b].v),uses:randi(6,10)};}
const engText=e=>ENG[e.k].t.replace('{v}',e.v)+(e.b?' · '+ENG_BONUS[e.b].t.replace('{v}',e.bv):'');
function engAdd(e){if(ENGS.length>=ENG_CAP){toast('Engraving pouch is full','');return false;}ENGS.push(e);storeEngs();return true;}
// The Beacons of an Atlas: plain nodes away from the start, spread out (its own random numbers, so old Atlases get them too).
function atlasBeacons(seed){const g=atlasGraph(seed);if(g.beacons)return g.beacons;const R=artRng(seed^0x5bd1e995),N=g.nodes,out=[];
  const cand=N.filter(n=>n.type==='plain'&&!n.start&&n.d>=2).sort(()=>R()-0.5);
  for(const n of cand){if(out.length>=BEACON_N)break;if(out.every(b=>nodeSteps(g,b,n.id,2)>2))out.push(n.id);}return g.beacons=out;}
// Steps between two nodes (more than max: max+1).
function nodeSteps(g,a,b,max){if(a===b)return 0;let f=new Set([a]),seen=new Set([a]);for(let d=1;d<=max;d++){const nx=new Set();for(const x of f)for(const y of g.nodes[x].nb)if(!seen.has(y)){if(y===b)return d;seen.add(y);nx.add(y);}f=nx;}return max+1;}
const isBeacon=(c,id)=>atlasBeacons(atlasOf(c).seed).includes(id);
const beaconsOf=c=>{const A=atlasOf(c);if(!A.bea||typeof A.bea!=='object')A.bea={};return A.bea;}; // {node: {lit, eng}}
// The Engravings acting on a node: every lit Beacon within 2 steps that holds one.
function engsFor(c,id){const g=atlasGraph(atlasOf(c).seed),B=beaconsOf(c);return atlasBeacons(atlasOf(c).seed).filter(b=>B[b]&&B[b].eng&&nodeSteps(g,b,id,BEACON_R)<=BEACON_R).map(b=>({b,e:B[b].eng}));}
// What they do for one run: summed into r.eg (set when the map opens, one use taken from each).
function engEffects(list){const o={qty:0,rar:0,cur:0,champ:0,hunt:0,asc:0,strife:0,abyss:0,life:0};
  for(const {e} of list){const v=e.v;if(e.k==='plenty')o.qty+=v;else if(e.k==='champions')o.champ+=v;else if(e.k==='hunt')o.hunt+=v;else if(e.k==='riches')o.cur+=v;
    else if(e.k==='ascension')o.asc+=v;else if(e.k==='strife'){o.strife+=v;o.qty+=v;}else if(e.k==='abyss'){o.abyss+=v;o.qty+=15*v;}
    if(e.b==='rar')o.rar+=e.bv;else if(e.b==='qty')o.qty+=e.bv;else if(e.b==='life')o.life+=e.bv;else if(e.b==='cur')o.cur+=e.bv;}return o;}
function useEngs(c,list){const B=beaconsOf(c);for(const {b} of list){const s=B[b];if(!s||!s.eng)continue;s.eng.uses--;if(s.eng.uses<=0){toast('An Engraving fades',ENG[s.eng.k].name);s.eng=null;}}}
function placeEng(c,node,e){const B=beaconsOf(c),s=B[node];if(!s||!s.lit||s.eng||!isBeacon(c,node))return false;const i=ENGS.indexOf(e);if(i<0)return false;ENGS.splice(i,1);storeEngs();s.eng=e;saveChar();return true;}
function takeEng(c,node){const s=beaconsOf(c)[node];if(!s||!s.eng||!engAdd(s.eng))return false;s.eng=null;saveChar();return true;}
function renderEngs(){return `<p class="sub">Place Engravings on lit Beacons (▲ on the Atlas). Each one changes every map within ${BEACON_R} steps, for its number of maps. Shared by your heroes (${ENGS.length}/${ENG_CAP}).</p>`+
  (ENGS.length?ENGS.map(e=>`<div class="slot"><div class="ic" style="color:${ENG[e.k].col}">▲</div><div class="info"><b style="color:${ENG[e.k].col}">${esc(ENG[e.k].name)}</b> <span class="fdim">${e.uses} maps</span><div>${esc(engText(e))}</div></div></div>`).join(''):'<p class="fdim">None yet: map bosses drop them (Boss nodes and a Beacon\'s first clear always).</p>');}
function pickEng(l){if(!engAdd(l.eng))return;l.taken=true;floatText(l.x,l.y-20,ENG[l.eng.k].name,ENG[l.eng.k].col,false);playSfx('pickup');}
function drawEngLoot(l,bob){const E=ENG[l.eng.k],x=l.x,y=l.y+bob;softShadow(x,y+8,9,3,0.8);ctx.fillStyle='rgba(0,0,0,.65)';ctx.beginPath();ctx.moveTo(x,y-11);ctx.lineTo(x+10,y+7);ctx.lineTo(x-10,y+7);ctx.closePath();ctx.fill();
  ctx.strokeStyle=E.col;ctx.lineWidth=1.6;ctx.stroke();lootLabel(x,y-18,E.name,E.col,E.col,null,null,true);}
