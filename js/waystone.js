'use strict';
// Waystone (in every town): travel to any town or depth this hero has reached. Every trip builds the level fresh, so
// its monsters are back each time. On boss depths (💀) you choose what comes back: everything, the boss alone
// (straight to the fight, no packs or shrines), or no boss (the packs only, portal open from the start).
let wayMode='all',wayEnd=0;
const WAY_MODES=[['all','Everything'],['boss','Boss only'],['noboss','No boss']];
const wayMax=()=>Math.max(G.char.maxDepth||1,G.char.depth||1);
function openWay(){if(!G.char||G.paused||!(G.inTown||G.zone&&hasWp(G.char,G.zone)))return; /* towns, and zone waypoints (zones.js) */wayEnd=0;$('wayOv').classList.remove('hidden');renderWay();setPause();}
function closeWay(){$('wayOv').classList.add('hidden');setPause();}
function setWayMode(m){if(WAY_MODES.some(x=>x[0]===m))wayMode=m;renderWay();}
function renderWay(){const M=wayMax(),cur=G.depth;
  $('wayModes').innerHTML=WAY_MODES.map(([k,n])=>`<div class="tab${k===wayMode?' on':''}" data-m="${k}">${n}</div>`).join('');
  let h='';
  for(let a=0;a<5;a++){const first=a*5+1;
    h+=`<div class="wayrow"><div class="wayn" style="color:${ACTS[a].col}">${roman(a+1)} · ${esc(ACTS[a].name)}</div><div class="wayb">`+
      `<div class="btn sm${first<=M?'':' dis'}" data-town="${first}">🏠 ${esc(TOWNS[a].name)}</div>`;
    if(a===0){const c=G.char;for(const z of ACT1_MAIN.concat(ACT1_SIDE)){const Z=ZONES[z],on=z==='a1z5'?M>=5:hasWp(c,z);h+=`<div class="btn sm${on?'':' dis'}${G.zone===z?' here':''}" data-z="${z}">${Z.parent?'↪ ':''}${esc(Z.name)}${z==='a1z5'?' 💀':''}</div>`;}}
    else for(let s=1;s<=5;s++){const d=first+s-1;h+=`<div class="btn sm${d<=M?'':' dis'}${d===cur?' here':''}" data-d="${d}">${s}${s===5?' 💀':''}</div>`;}
    h+='</div></div>';}
  if(M>25){wayEnd=clamp(wayEnd||M,26,M);const d=wayEnd;
    h+=`<div class="wayrow"><div class="wayn" style="color:#c79bff">Endless Depths <span class="fdim">(up to ${M-25})</span></div><div class="wayb">`+
      [-5,-1].map(n=>`<div class="btn sm" data-e="${n}">${n}</div>`).join('')+
      `<span class="wayend">Endless ${d-25} · ${esc(ACTS[actIdx(d)].name)} ${stageOf(d)}${d%5===0?' 💀':''}</span>`+
      [1,5].map(n=>`<div class="btn sm" data-e="${n}">+${n}</div>`).join('')+
      `<div class="btn sm" data-d="${d}">Go</div><div class="btn sm" data-town="${d}">🏠 ${esc(townOf(d).name)}</div></div></div>`;}
  $('wayList').innerHTML=h;
  $('wayModes').querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>setWayMode(el.dataset.m));
  $('wayList').querySelectorAll('[data-d]').forEach(el=>el.onclick=()=>wayGo(+el.dataset.d,false));
  $('wayList').querySelectorAll('[data-z]').forEach(el=>el.onclick=()=>{const z=el.dataset.z;closeWay();startZone(z,z==='a1z5'?wayMode:undefined);});
  $('wayList').querySelectorAll('[data-town]').forEach(el=>el.onclick=()=>wayGo(+el.dataset.town,true));
  $('wayList').querySelectorAll('[data-e]').forEach(el=>el.onclick=()=>{wayEnd=clamp(wayEnd+ +el.dataset.e,26,M);renderWay();});}
// Travel. Returns false for a depth this hero hasn't reached.
function wayGo(d,town){if(!G.char||d<1||d>wayMax())return false;closeWay();
  if(town){if(!(G.inTown&&actIdx(d)===actIdx(G.depth)&&cycleOf(d)===cycleOf(G.depth)))startTown(d);return true;}
  startDepth(d,d%5===0?wayMode:'all');return true;}
// From the pause menu, anywhere in the dungeon: back to this act's town; the depth you left is rebuilt when you return.
function returnToTown(){if(!G.char||G.inTown)return;$('menuOv').classList.add('hidden');startTown(G.depth);}
tap('wayBtn',openWay);
tap('wayClose',closeWay);
tap('townBtn',returnToTown);
