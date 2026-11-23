'use strict';
// Waystone (in every town): travel to any town or depth this hero has reached. Every trip builds the level fresh, so
// its monsters are back each time. On boss depths (💀) you choose what comes back: everything, the boss alone
// (straight to the fight, no packs or shrines), or no boss (the packs only, portal open from the start).
// Difficulty tabs (once Normal is beaten): the list shows that difficulty's towns and waypoints; travelling there
// switches the hero to it (zones.js setDiff). The Endless Depths are one ladder for every difficulty, open once
// Normal is beaten, and scale with the highest difficulty beaten (maps.js powDepth).
let wayMode='all',wayEnd=0,wayDiff=null;
const WAY_MODES=[['all','Everything'],['boss','Boss only'],['noboss','No boss']];
const wayD=()=>wayDiff??(G.char.diff||0);
const wayMax=()=>{const c=G.char,S=diffState(c,wayD());return Math.max(S.maxDepth||1,wayD()===(c.diff||0)&&c.depth<=25?c.depth:1);}; // story depths reached in that difficulty
const endMax=()=>{const c=G.char;return c.won?Math.max(26,c.endMax||0,c.depth>25?c.depth:0):0;};
function openWay(){if(!G.char||G.paused||!(G.inTown||G.zone&&hasWp(G.char,G.zone)))return; /* towns, and zone waypoints (zones.js) */wayEnd=0;wayDiff=null;$('wayOv').classList.remove('hidden');renderWay();setPause();}
function closeWay(){$('wayOv').classList.add('hidden');setPause();}
function setWayMode(m){if(WAY_MODES.some(x=>x[0]===m))wayMode=m;renderWay();}
function setWayDiff(d){if(d>=0&&d<=Math.min(DIFF_N-1,G.char.diffDone||0))wayDiff=d;renderWay();}
function renderWay(){const c=G.char,M=wayMax(),wd=wayD(),S=diffState(c,wd),same=wd===(c.diff||0),cur=same?G.depth:0,E=endMax();
  $('wayModes').innerHTML=((c.diffDone||0)>0?DIFFS.slice(0,Math.min(DIFF_N,(c.diffDone||0)+1)).map((D,i)=>`<div class="tab${i===wd?' on':''}" data-dif="${i}" style="color:${D.col}">${D.name}</div>`).join('')+'<span class="fdim"> · </span>':'')+
    WAY_MODES.map(([k,n])=>`<div class="tab${k===wayMode?' on':''}" data-m="${k}">${n}</div>`).join('');
  let h='';
  for(let a=0;a<5;a++){const first=a*5+1;
    h+=`<div class="wayrow"><div class="wayn" style="color:${ACTS[a].col}">${roman(a+1)} · ${esc(ACTS[a].name)}</div><div class="wayb">`+
      `<div class="btn sm${first<=M?'':' dis'}" data-town="${first}">🏠 ${esc(TOWNS[a].name)}</div>`;
    const AZ=actZones(a+1);if(AZ.length){for(const z of AZ.concat(actSides(a+1))){const Z=ZONES[z],boss=Z.layout==='boss',on=boss?M>=Z.depth:(S.wps||[]).includes(z);h+=`<div class="btn sm${on?'':' dis'}${same&&G.zone===z?' here':''}" data-z="${z}">${Z.parent?'↪ ':''}${esc(Z.name)}${boss?' 💀':''}</div>`;}}
    else for(let s=1;s<=5;s++){const d=first+s-1;h+=`<div class="btn sm${d<=M?'':' dis'}${d===cur?' here':''}" data-d="${d}">${s}${s===5?' 💀':''}</div>`;}
    h+='</div></div>';}
  if(E>25){wayEnd=clamp(wayEnd||E,26,E);const d=wayEnd,sc=Math.max(0,(c.diffDone||0)-1);
    h+=`<div class="wayrow"><div class="wayn" style="color:#c79bff">Endless Depths <span class="fdim">(up to ${E-25} · as hard as ${DIFFS[sc].name})</span></div><div class="wayb">`+
      [-5,-1].map(n=>`<div class="btn sm" data-e="${n}">${n}</div>`).join('')+
      `<span class="wayend">Endless ${d-25} · ${esc(ACTS[actIdx(d)].name)} ${stageOf(d)}${d%5===0?' 💀':''}</span>`+
      [1,5].map(n=>`<div class="btn sm" data-e="${n}">+${n}</div>`).join('')+
      `<div class="btn sm" data-d="${d}">Go</div><div class="btn sm" data-town="${d}">🏠 ${esc(townOf(d).name)}</div></div></div>`;}
  $('wayList').innerHTML=h;
  $('wayModes').querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>setWayMode(el.dataset.m));
  $('wayModes').querySelectorAll('[data-dif]').forEach(el=>el.onclick=()=>setWayDiff(+el.dataset.dif));
  $('wayList').querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>wayGo(+el.dataset.d,false));
  $('wayList').querySelectorAll('[data-z]').forEach(el=>el.onclick=()=>{const z=el.dataset.z;if(el.classList.contains('dis'))return;const wd=wayD();closeWay();playSfx('portal');setDiff(G.char,wd);startZone(z,ZONES[z].layout==='boss'?wayMode:'fresh');});
  $('wayList').querySelectorAll('[data-town]').forEach(el=>el.onclick=()=>wayGo(+el.dataset.town,true));
  $('wayList').querySelectorAll('[data-e]').forEach(el=>el.onclick=()=>{wayEnd=clamp(wayEnd+ +el.dataset.e,26,E);renderWay();});}
// Travel. Returns false for a depth this hero hasn't reached.
function wayGo(d,town){if(!G.char||d<1||(d<=25?d>wayMax():d>endMax()))return false;const wd=wayD();closeWay();playSfx('portal');
  const sw=d<=25&&setDiff(G.char,wd); // zones.js: into the chosen difficulty
  if(town){if(sw||!(G.inTown&&actIdx(d)===actIdx(G.depth)&&cycleOf(d)===cycleOf(G.depth)))startTown(d);return true;}
  startDepth(d,d%5===0?wayMode:'all');return true;}
// From the pause menu, anywhere outside a boss fight: back to this act's town (zones are kept for the return portal).
function returnToTown(){if(!G.char||G.inTown)return;$('menuOv').classList.add('hidden');if(bossFightOn()){setPause();toast('No portal now','Not during a boss fight');return;}openPortal();} /* portal.js: same as a portal, without the cast */
tap('wayBtn',openWay);
tap('wayClose',closeWay);
tap('townBtn',returnToTown);
