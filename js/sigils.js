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
const mapPD=r=>75+2*r.sig.tier;
// The map's modifiers as one table {key: value}.
function mapModsOf(r){const o={};for(const m of r.sig.mods)o[m.k]=modV(m);return o;}
const MAPM=()=>inMap()?(G.char.mapRun.mm||(G.char.mapRun.mm=mapModsOf(G.char.mapRun))):null;
// The zone a map is built from: a main or side zone (not an act boss arena), its boss and champions random.
function mapSource(){const zs=Object.keys(ZONES).filter(z=>!ZONES[z].map&&ZONES[z].layout!=='boss'&&ZONES[z].act);return pick(zs);}
function regMapZone(r){const Z=ZONES[r.src]||ZONES.a1z1,mm=mapModsOf(r);
  ZONES.map=Object.assign({},Z,{name:'Map: '+Z.name,sub:`Tier ${r.sig.tier} · ${r.sig.mods.length} modifier${r.sig.mods.length===1?'':'s'}`,map:true,parent:null,side:null,next:null,gate:'boss',
    key:null,captive:null,hoard:0,boss:r.boss,su:r.su,density:(Z.density||1.2)*(1+(mm.mpack||0)/100),elite:(Z.elite??0.2)*(1+(mm.melite||0)/100)});return ZONES.map;}
function openMap(s){const c=G.char;if(!mapsOpen(c)||c.mapRun&&c.mapRun.lives>0&&!c.mapRun.done)return false;const i=SIGILS.indexOf(s);if(i<0)return false;
  SIGILS.splice(i,1);storeSigils();const zb=Object.keys(ZBOSS),su=Object.keys(SUPERU);
  c.mapRun={sig:s,src:mapSource(),boss:pick(zb),su:shuffle(su.slice()).slice(0,randi(1,2)),lives:SIG_LIVES,done:false,town:G.inTown?G.depth:c.depth<=25?c.depth:25};
  regMapZone(c.mapRun);if(c.zst)delete c.zst.map;closeMapDevice();startZone('map','fresh');playSfx('portal');return true;}
// Leaving: complete (portal after the boss), failed (no lives left) or abandoned (travel elsewhere).
function endMap(why){const c=G.char,r=c&&c.mapRun;if(!r)return;c.mapRun=null;if(c.tp&&c.tp.zid==='map')c.tp=null;if(INST.z.map){delete INST.z.map;instStore();}
  if(why==='fail')toast('The map collapses','No lives left: the Sigil is lost');else if(why==='abandon')toast('Your map closed','You travelled away from it');saveChar();return r;}
function mapLeave(){const c=G.char,town=c.mapRun?c.mapRun.town:25;endMap('done');startTown(town);}
// Map boss down: the map is complete; Sigils drop (often a tier up), the portal home opens (zones.js zoneBossDown).
function mapComplete(e){const c=G.char,r=c.mapRun;if(!r||r.done)return;r.done=true;const M=c.maps||(c.maps={done:0,best:0});M.done++;M.best=Math.max(M.best,r.sig.tier);
  const n=1+(Math.random()<0.4?1:0);for(let i=0;i<n;i++){const t=r.sig.tier+(Math.random()<0.35?1:Math.random()<0.25?-1:0);dropSigil(e.x+rand(-40,40),e.y+rand(-40,40),genSigil(t));}
  toast('Map complete!',`Tier ${r.sig.tier} · ${M.done} maps done · the portal leads home`);playSfx('levelup');saveChar();}
// ---------- Sigil drops ----------
function dropSigil(x,y,s){if(blockedAt(x,y,4)){x=G.p.x;y=G.p.y;}G.loot.push({x,y,sig:s,t:0});playSfx('rune');}
// From kills: maps (champions more), Hell act bosses and the endless depths once maps are open.
function sigilDrops(e,kind){const c=G.char;if(!mapsOpen(c))return;
  if(inMap()){const ch=kind==='elite'||kind==='su'?0.04:kind==='normal'?0.004:0;if(Math.random()<ch)dropSigil(e.x,e.y,genSigil(c.mapRun.sig.tier));return;}
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
function mapLoot(){const r=G.char.mapRun,L=DIFFS[2].loot,q=1+sigQuant(r.sig)/100;return Object.assign({},L,{drop:L.drop*q,cur:L.cur*q,rar:L.rar+sigRar(r.sig),pity:100});}
// ---------- the Map Device window (from the Waystone) ----------
let mapSel=null;
function openMapDevice(){const c=G.char;if(!mapsOpen(c))return;mapSel=null;$('mapOv').classList.remove('hidden');renderMapDevice();setPause();}
function closeMapDevice(){$('mapOv').classList.add('hidden');setPause();}
function renderMapDevice(){const c=G.char,r=c.mapRun,M=c.maps||{done:0,best:0};
  const open=r&&r.lives>0?`<div class="pinfo"><b>Open map:</b> ${esc(ZONES.map?ZONES.map.name:'')} · Tier ${r.sig.tier} · ${'♥'.repeat(r.lives)} ${r.done?'(complete)':''}<div class="row"><div class="btn sm" id="mapBack">Return to it</div><div class="btn sm red" id="mapQuit">Abandon</div></div></div>`:'';
  $('mapSub').innerHTML=`${M.done} maps done · best Tier ${M.best||'–'} · ${SIGILS.length}/${SIG_CAP} Sigils (shared by your heroes). Each map: ${SIG_LIVES} lives.`;
  const list=SIGILS.slice().sort((a,b)=>b.tier-a.tier||b.rarity-a.rarity);
  $('mapList').innerHTML=open+(list.length?list.map(s=>`<div class="slot${mapSel===s?' cur-ok':''}" data-sig="${SIGILS.indexOf(s)}"><div class="ic" style="color:${SIG_COL[s.rarity]}">◆<small>${s.tier}</small></div><div class="info"><b style="color:${SIG_COL[s.rarity]}">${sigName(s)}</b> <span class="fdim">+${sigQuant(s)}% quantity · +${sigRar(s)}% rarity</span>${s.mods.map(m=>`<div class="smod ${MAP_MODS[m.k].p?'mp':'ms'}">${esc(modText(m))} <span class="fdim">(T${m.t})</span></div>`).join('')}</div></div>`).join(''):'<p class="fdim">No Sigils yet. Hell act bosses and zone bosses, the Endless Depths and maps drop them.</p>');
  const s=mapSel;let h='';
  if(s){h=`<b style="color:${SIG_COL[s.rarity]}">${sigName(s)}</b> <span class="fdim">power like depth ${75+2*s.tier} · area level ${areaLvl(75+2*s.tier)}</span>
    <div class="row" style="margin-top:4px">${CUR_KEYS.filter(k=>!CURS[k].cat&&!['awl','spindle','whet'].includes(k)).map(k=>{const why=curCount(k)<1?'none':sigCurBlock(k,s);return `<div class="btn sm${why?' dis':''}" data-sc="${k}" title="${esc(why||CURS[k].name)}"><span style="color:${CURS[k].col}">${CURS[k].ic}</span> ×${curCount(k)}</div>`;}).join('')}</div>
    <div class="row"><div class="btn sm${r&&r.lives>0&&!r.done?' dis':''}" id="mapGo">🗺 Open map</div><div class="btn sm red" id="mapSalv">Discard</div></div>`;}
  $('mapInfo').innerHTML=h||'<span class="fdim">Tap a Sigil to craft it or open its map. Modifiers make a map harder and add Item Quantity and Rarity.</span>';
  $('mapList').querySelectorAll('[data-sig]').forEach(el=>el.onclick=()=>{mapSel=SIGILS[+el.dataset.sig];renderMapDevice();});
  $('mapInfo').querySelectorAll('[data-sc]').forEach(el=>el.onclick=()=>{const msg=sigUseCur(el.dataset.sc,s);if(msg)toast(CURS[el.dataset.sc].name,msg);renderMapDevice();});
  if($('mapGo'))$('mapGo').onclick=()=>{if(!openMap(s))toast('Finish or abandon your open map first');};
  if($('mapSalv'))$('mapSalv').onclick=()=>{const i=SIGILS.indexOf(s);if(i>=0){SIGILS.splice(i,1);storeSigils();mapSel=null;renderMapDevice();}};
  if($('mapBack'))$('mapBack').onclick=()=>{closeMapDevice();closeWay();regMapZone(r);startZone('map',hasInstance('map')?'tp':'fresh');};
  if($('mapQuit'))$('mapQuit').onclick=()=>{endMap('abandon');renderMapDevice();};}
tap('mapClose',closeMapDevice);
