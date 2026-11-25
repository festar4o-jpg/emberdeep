// Ember gems (v1.0.122): gems that only Ember Rift Guardians drop and that level up with every Rift cleared in time.
// Each hero keeps c.emb = {own: {gem: level}, slots: [gem or null, gem or null]} (save v16). Slots open with Rift
// progress (EMB_SLOT_AT: the first in-time clear, then Rift 15). A worn gem gains a level for every in-time clear, and
// one more when the Rift is at least its level; no cap, but a gem only climbs fast in Rifts as high as itself.
// A Guardian killed in time has an EMB_DROP chance to drop a gem: a new one is yours at level 1, one you have adds
// EMB_DUPE levels. Shown and swapped in the 🎒 bag (under the charms).
// Effects (v1.0.123): emberStats (items.js calcStats: Wrath = Boss Damage, Haste, Bastion = less damage taken, Fortune,
// and the numbers the hooks read), emberHitMul (game.js hitEnemy: Glacier), emberOnHit (Leech, Storm), ailments.js
// igniteHit (Pyre). EMB_V holds each gem's number at a level, so the text and the effect can never disagree.
const EMB_DROP=0.25,EMB_DUPE=3,EMB_SLOT_AT=[1,15];
const EMB_V={wrath:l=>10+0.4*(l-1),glacier:l=>10+0.3*(l-1),haste:l=>5+0.1*(l-1),leech:l=>1+0.02*(l-1),bastion:l=>Math.min(20,6+0.1*(l-1)),
  fortune:l=>Math.round(15+0.5*(l-1)),storm:l=>Math.round(200+5*(l-1)),pyre:l=>Math.round(20+(l-1))};
const STORM_CD=8; // balance: Storm at level 50 (445% every 8s) is about +30% damage, like Wrath on bosses
const EMBERS={
  wrath:{name:'Wrath',ic:'🔥',col:'#ff6a3a',t:l=>`+${EMB_V.wrath(l).toFixed(1)}% damage to bosses and Rift Guardians`},
  glacier:{name:'Glacier',ic:'❄',col:'#9fe4ff',t:l=>`Chilled and Frozen enemies take +${EMB_V.glacier(l).toFixed(1)}% damage`},
  haste:{name:'Haste',ic:'➶',col:'#a8e0c0',t:l=>`+${EMB_V.haste(l).toFixed(1)}% Attack or Cast Speed`},
  leech:{name:'Leech',ic:'🩸',col:'#e04060',t:l=>`Heal ${EMB_V.leech(l).toFixed(2)}% of the damage you deal`},
  bastion:{name:'Bastion',ic:'⛨',col:'#c8b088',t:l=>`${EMB_V.bastion(l).toFixed(1)}% less damage taken`},
  fortune:{name:'Fortune',ic:'🪙',col:'#ffd36b',t:l=>`+${EMB_V.fortune(l)}% Gold Found and Item Rarity`},
  storm:{name:'Storm',ic:'⚡',col:'#a0d0ff',t:l=>`Every ${STORM_CD}s your next hit calls lightning for ${EMB_V.storm(l)}% damage`},
  pyre:{name:'Pyre',ic:'♨',col:'#ff9a3a',t:l=>`Your Ignites burn ${EMB_V.pyre(l)}% harder`}};
const EMB_KEYS=Object.keys(EMBERS);
const embOf=c=>c.emb&&typeof c.emb==='object'?c.emb:(c.emb={own:{},slots:[null,null]});
const emberSlots=c=>{const b=typeof riftOf==='function'?riftOf(c).best:0;return EMB_SLOT_AT.filter(x=>b>=x).length;};
// v16: a valid table; slots only hold gems you own, once each, in open slots.
function fixEmbers(c){const E=embOf(c);if(!E.own||typeof E.own!=='object')E.own={};for(const k of Object.keys(E.own))if(!EMBERS[k]||!(E.own[k]>=1))delete E.own[k];else E.own[k]=Math.floor(E.own[k]);
  const s=Array.isArray(E.slots)?E.slots:[];E.slots=[0,1].map(i=>{const k=s[i];return k&&E.own[k]&&s.indexOf(k)===i?k:null;});return E;}
// The gems working now: [key, level] for each filled, open slot.
function emberWorn(c){const E=embOf(c),n=emberSlots(c);return E.slots.slice(0,n).filter(Boolean).map(k=>[k,E.own[k]]);}
// A Rift cleared in time (rifts.js riftDone): worn gems level up, and maybe a new gem drops. Returns a line for the toast.
function riftEmbers(L){const c=G.char,E=embOf(c),parts=[];
  for(const [k] of emberWorn(c)){const up=1+(L>=E.own[k]?1:0);E.own[k]+=up;parts.push(`${EMBERS[k].name} ${E.own[k]}`);}
  if(Math.random()<EMB_DROP){const k=pick(EMB_KEYS);if(E.own[k]){E.own[k]+=EMB_DUPE;parts.push(`Ember of ${EMBERS[k].name} +${EMB_DUPE}`);}
    else{E.own[k]=1;const free=[0,1].find(i=>i<emberSlots(c)&&!E.slots[i]);if(free!=null)E.slots[free]=k;parts.push(`new: Ember of ${EMBERS[k].name}!`);}
    if(G.p)burst(G.p.x,G.p.y,30,EMBERS[k].col,240);}
  return parts.length?' · Embers: '+parts.join(', '):'';}
// ---------- effects ----------
function emberStats(c,s){s.embGlacier=0;s.embLeech=0;s.embStorm=0;s.embPyre=0;
  for(const [k,l] of emberWorn(c)){const v=EMB_V[k](l);
    if(k==='wrath')s.bossdmg=(s.bossdmg||0)+v;else if(k==='haste'){const sk=c.cls==='arcanist'?'cspd':'aspd';s[sk]=(s[sk]||0)+v;}
    else if(k==='bastion')s.dr=(s.dr||0)+v;else if(k==='fortune'){s.gold=(s.gold||0)+v;s.rarity=(s.rarity||0)+v;}
    else if(k==='glacier')s.embGlacier=v;else if(k==='leech')s.embLeech=v;else if(k==='storm')s.embStorm=v;else if(k==='pyre')s.embPyre=v;}}
const emberHitMul=e=>{const v=G.stats&&G.stats.embGlacier;return v&&(e.chillT>0||e.frozen>0)?1+v/100:1;};
// After a hit lands: Leech heals; Storm, when ready, strikes the same enemy with lightning (not from damage over time,
// splashes or its own strike).
function emberOnHit(e,d,opts){const s=G.stats,p=G.p;if(!s||!p||opts.dot)return;
  if(s.embLeech&&d>0)healPlayer(d*s.embLeech/100,true);
  if(s.embStorm&&!(p.stormT>0)&&!opts.splashed&&!opts.storm&&!e.dead){p.stormT=STORM_CD;
    G.fx.push({type:'bolt',pts:[{x:e.x+rand(-10,10),y:e.y-260},{x:e.x,y:e.y}],t:0,max:0.25});burst(e.x,e.y,14,'#a0d0ff',200);G.shake=Math.max(G.shake,4);
    const sk=G.sk;G.sk=null;hitEnemy(e,s.embStorm/100,{storm:true,splashed:true,quiet:true});G.sk=sk;}}
// ---------- the 🎒 bag (ui.js renderInv) ----------
let embPick=null; // the slot being changed
function emberHtml(c){const E=fixEmbers(c),n=emberSlots(c),own=Object.keys(E.own);
  const slot=i=>{const k=E.slots[i],open=i<n;if(!open)return `<div class="ember lk" title="Opens at Rift ${EMB_SLOT_AT[i]} cleared in time">🔒<small>Rift ${EMB_SLOT_AT[i]}</small></div>`;
    return k?`<div class="ember${embPick===i?' sel':''}" data-es="${i}" style="border-color:${EMBERS[k].col}"><span style="color:${EMBERS[k].col}">${EMBERS[k].ic}</span><small>${E.own[k]}</small></div>`
      :`<div class="ember empty${embPick===i?' sel':''}" data-es="${i}">+</div>`;};
  let h=`<div class="row" style="justify-content:space-between;margin-top:8px"><span>Ember gems</span><span class="fdim">${own.length?'level up in Ember Rifts':'drop from Rift Guardians'}</span></div><div class="embrow">${slot(0)}${slot(1)}</div>`;
  const worn=emberWorn(c);if(worn.length)h+=worn.map(([k,l])=>`<div class="embt"><b style="color:${EMBERS[k].col}">${EMBERS[k].ic} Ember of ${EMBERS[k].name} ${l}</b> ${esc(EMBERS[k].t(l))}</div>`).join('');
  if(embPick!=null){const free=own.filter(k=>!E.slots.includes(k));
    h+=`<div class="embpick">${free.map(k=>`<div class="btn sm" data-eg="${k}"><span style="color:${EMBERS[k].col}">${EMBERS[k].ic}</span> ${EMBERS[k].name} ${E.own[k]}</div>`).join('')||'<span class="fdim">No other Ember gems yet.</span>'}${E.slots[embPick]?'<div class="btn sm red" data-eg="">Take out</div>':''}</div>`;}
  return h;}
function emberBind(c,box){box.querySelectorAll('[data-es]').forEach(el=>el.onclick=()=>{const i=+el.dataset.es;embPick=embPick===i?null:i;renderInv();});
  box.querySelectorAll('[data-eg]').forEach(el=>el.onclick=()=>{const E=embOf(c),k=el.dataset.eg||null;if(embPick==null)return;E.slots[embPick]=k;embPick=null;refreshStats();saveChar();renderInv();});}
// ---------- 📖 Book › Embers (sockets.js renderBook): every gem, and which of your heroes has it at what level ----------
function renderEmberBook(){const has=k=>SAVES.filter(c=>c&&c.emb&&c.emb.own&&c.emb.own[k]).map(c=>`${esc(c.name)} ${c.emb.own[k]}`);
  $('bookSub').textContent=`Ember gems drop only from Rift Guardians killed in time (about 1 in ${Math.round(1/EMB_DROP)}). A worn gem gains a level with every Rift cleared in time, two when the Rift is at least its level. Slots: the first Rift cleared, then Rift ${EMB_SLOT_AT[1]}.`;
  $('bookList').innerHTML=EMB_KEYS.map(k=>{const G0=EMBERS[k],h=has(k);return `<div class="slot"><div class="ic" style="color:${G0.col}">${G0.ic}</div><div class="info"><b style="color:${G0.col}">Ember of ${G0.name}</b>
    <div class="fdim">Level 1: ${esc(G0.t(1))} · level 50: ${esc(G0.t(50))}</div><div>${h.length?h.map(esc).join(' · '):'<span class="fdim">Not found yet</span>'}</div></div></div>`;}).join('');}
