// Passive tree (v1.0.104-105, PoE2 style). One shared tree: the Warden starts on the left, the Arcanist on the right,
// the Ranger (v1.0.132) at the bottom, with his two branches beside him and the Point Blank keystone below.
// Each hero keeps what they took in c.pas = {n: [node ids], ch: {node id: picked option}} (save v13).
// Points: 1 per level after 1, PAS_BOSS_PTS for each act boss's first kill (c.pasBoss, a bit per act, any difficulty)
// and 1 per Paragon level (which no longer gives +1% damage and +5 Life). Taking a node costs 1 point; a node can be
// taken when it touches your start or a node you have. Stats from taken nodes go into calcStats (items.js) via pasStats.
// Node kinds: start (your class's is free and always yours; the other class's is a small node), small, choice (pick one
// of three bonuses when you take it, like PoE2's attribute nodes), notable (bigger, named), key (keystone: a rule
// change with a downside; soon:true = shown but not takeable yet). The screen is in treeui.js.
const PAS_BOSS_PTS=2,PAS_ACTS=5;
// ---------- the tree ----------
// Small-node stats by theme. 'aspd'/'cspd' become the hero's own speed stat (Attack Speed for the Warden, Cast Speed
// for the Arcanist); 'armpct' is % more Armor (only from the tree).
// v1.0.107 balance: a full level-50 tree should make a hero clearly stronger, not several times stronger.
const PAS_SMALL={life:['lifepct',2],armor:['armpct',5],block:['block',1],bleed:['bleed',3],speed:['aspd',1.5],critd:['critd',4],loh:['loh',1],
  spell:['spell',1.5],ignite:['igniteCh',1.5],shock:['shockCh',1.5],poison:['poisonCh',1.5],mana:['res',6],cdr:['cdr',1],crit:['crit',0.4],
  move:['move',1],res:['ares',2],evade:['evade',0.8],regen:['regen',0.5],pot:['potheal',5],rarity:['rarity',3],gold:['gold',5],dmg:['dmg',1],dr:['dr',0.5]};
const PAS_CHOICE=[{name:'Might',st:[['lifepct',1.5]]},{name:'Fury',st:[['dmg',1]]},{name:'Haste',st:[['aspd',1]]}];
// Notables on the branches off the outer ring, by side (the ring's odd slots, see pasBuild).
const PAS_NOTABLE={
  warden:[{id:'ironskin',name:'Iron Skin',sm:['armor','life'],st:[['armpct',12],['lifepct',3]]},
    {id:'shieldwall',name:'Shield Wall',sm:['block','armor'],st:[['block',3],['armpct',6]]},
    {id:'rhythm',name:"Butcher's Rhythm",sm:['bleed','speed'],st:[['aspd',4],['bleed',6]]},
    {id:'edge',name:"Executioner's Edge",sm:['critd','dmg'],st:[['critd',12],['dmg',3]]},
    {id:'bloodthirst',name:'Bloodthirst',sm:['loh','life'],st:[['loh',4],['lpk',6],['lifepct',2]]},
    {id:'hardened',name:'Battle Hardened',sm:['life','dr'],st:[['dr',2],['lifepct',3]]}],
  arcanist:[{id:'torrent',name:'Arcane Torrent',sm:['spell','speed'],st:[['spell',6],['cspd',3]]},
    {id:'pyro',name:'Pyromancy',sm:['ignite','spell'],st:[['igniteCh',5],['spell',3]]},
    {id:'stormlore',name:'Storm Lore',sm:['shock','crit'],st:[['shockCh',5],['crit',1]]},
    {id:'well',name:'Deep Well',sm:['mana','cdr'],st:[['res',30],['cdr',3]]},
    {id:'blight',name:'Blight',sm:['poison','dmg'],st:[['poisonCh',5],['dmg',3]]},
    {id:'weaver',name:'Spellweaver',sm:['speed','cdr'],st:[['cspd',4],['cdr',2]]}],
  shared:[{id:'wind',name:'Wind Walker',sm:['move','evade'],st:[['move',4],['evade',3]]},
    {id:'ward',name:'Elemental Ward',sm:['res','regen'],st:[['ares',8]]}],
  ranger:[{id:'deadeye',name:'Deadeye',sm:['crit','critd'],st:[['crit',1.5],['critd',10]]}, // v1.0.132: either side of his start
    {id:'huntpack',name:'Hunting Pack',sm:['speed','life'],st:[['petdmg',20],['aspd',3]]}],
  inner:[{id:'hunter',name:'Treasure Hunter',sm:['rarity','gold'],st:[['rarity',12],['gold',20]]},
    {id:'alch',name:'Alchemist',sm:['pot','regen'],st:[['potheal',25],['regen',3]]}]};
// Keystones at the end of four long branches (v1.0.106). ks: the flag in G.stats.ks; effects in pasFinal and where
// they act (marked "passives.js": uniques.js lifeCost, game.js rollDmg / tryDodge / slowPlayer, ailments.js freeze).
const PAS_KEYS=[{id:'k_bloodmagic',ks:'bloodmagic',name:'Blood Magic',t:'Your skills cost Life instead of Mana or Fury (the same share of your Life as of your Mana or Fury) · 15% less maximum Life'},
  {id:'k_unwavering',ks:'unwavering',name:'Unwavering',t:'You can\'t be Frozen or slowed, and take 10% less damage · you can\'t dodge'},
  {id:'k_glass',ks:'glass',name:'Glass Cannon',t:'30% more damage · 30% less maximum Life'},
  {id:'k_overload',ks:'overload',name:'Elemental Overload',t:'Your chances to Ignite, Shock and Poison are doubled · you never deal critical hits'}];
// v1.0.132: below the Ranger's start, past Elemental Ward (game.js projectile hits: pointBlankMul)
const PAS_KEY_RANGER={id:'k_pointblank',ks:'pointblank',name:'Point Blank',t:'Your arrows and other projectiles deal up to 40% more damage up close (within 150) · up to 30% less far away (from 450)'};
const PAS_CENTER={id:'heart',name:'Heart of Embers',st:[['dmg',4],['lifepct',3]]};
const PAS_NODES={};let PAS_EDGES=[];
function pasBuild(){
  const N=PAS_NODES,E=[],add=(id,x,y,t,o)=>N[id]=Object.assign({id,x:Math.round(x),y:Math.round(y),t,adj:[]},o||{}),
    link=(a,b)=>{N[a].adj.push(b);N[b].adj.push(a);E.push([a,b]);},
    at=(r,a)=>[Math.cos(a)*r,-Math.sin(a)*r],small=th=>({st:[PAS_SMALL[th].slice()],th});
  const RO=620,RI=300,NO=28,NI=16,ao=i=>i/NO*TAU,ai=k=>k/NI*TAU;
  const ringSmall=i=>{const c=Math.cos(ao(i));return c>0.3?(i%4?'spell':'mana'):c<-0.3?(i%4?'life':'armor'):(i%4?'move':'res');};
  // outer ring: the two starts, choice nodes in the odd slots (where the branches leave), small nodes between
  for(let i=0;i<NO;i++){const [x,y]=at(RO,ao(i)),id='o'+i;
    if(i===0)add(id,x,y,'start',{cls:'arcanist',name:'Arcanist',st:[['dmg',3]]});
    else if(i===NO/2)add(id,x,y,'start',{cls:'warden',name:'Warden',st:[['dmg',3]]});
    else if(i===NO*3/4)add(id,x,y,'start',{cls:'ranger',name:'Ranger',st:[['dmg',3]]}); // v1.0.132 (it was a choice node)
    else if(i%2)add(id,x,y,'choice',{opts:PAS_CHOICE});else add(id,x,y,'small',small(ringSmall(i)));}
  for(let i=0;i<NO;i++)link('o'+i,'o'+(i+1)%NO);
  // inner ring: choice and small nodes, and the Heart of Embers in the middle (to the four diagonals)
  const innerTh=['crit','move','res','evade','regen','dr','dmg','crit'];
  for(let k=0;k<NI;k++){const [x,y]=at(RI,ai(k));if(k%2)add('i'+k,x,y,'choice',{opts:PAS_CHOICE});else add('i'+k,x,y,'small',small(innerTh[k/2]));}
  for(let k=0;k<NI;k++)link('i'+k,'i'+(k+1)%NI);
  add(PAS_CENTER.id,0,0,'notable',{name:PAS_CENTER.name,st:PAS_CENTER.st});for(const k of [2,6,10,14])link(PAS_CENTER.id,'i'+k);
  // spokes: outer ring to the nearest inner node, two small nodes on the way
  for(const i of [0,4,10,14,18,24]){const k=Math.round(ao(i)/TAU*NI)%NI,[x0,y0]=at(RO,ao(i)),[x1,y1]=at(RI,ai(k));let prev='o'+i;
    for(let j=1;j<=2;j++){const f=j/3,id=`s${i}_${j}`;add(id,x0+(x1-x0)*f,y0+(y1-y0)*f,'small',small(j===1?ringSmall(i):'dmg'));link(prev,id);prev=id;}link(prev,'i'+k);}
  // branches: three small nodes and a notable outward from each odd outer slot, by side
  const pool={warden:PAS_NOTABLE.warden.slice(),arcanist:PAS_NOTABLE.arcanist.slice(),shared:PAS_NOTABLE.shared.slice()};
  for(let i=1;i<NO;i+=2){const c=Math.cos(ao(i)),side=c>0.3?'arcanist':c<-0.3?'warden':'shared',B=pool[side].shift();if(!B)continue;let prev='o'+i;
    [715,800,885].forEach((r,j)=>{const [x,y]=at(r,ao(i)),id=`b${i}_${j}`;add(id,x,y,'small',small(B.sm[j===1?1:0]));link(prev,id);prev=id;});
    const [x,y]=at(985,ao(i));add(B.id,x,y,'notable',{name:B.name,st:B.st,side});link(prev,B.id);}
  // v1.0.132: the Ranger's branches from the ring slots either side of his start, and Point Blank below Elemental Ward
  [[20,PAS_NOTABLE.ranger[0]],[22,PAS_NOTABLE.ranger[1]]].forEach(([i,B])=>{let prev='o'+i;
    [715,800,885].forEach((r,j)=>{const [x,y]=at(r,ao(i)),id=`r${i}_${j}`;add(id,x,y,'small',small(B.sm[j===1?1:0]));link(prev,id);prev=id;});
    const [x,y]=at(985,ao(i));add(B.id,x,y,'notable',{name:B.name,st:B.st,side:'ranger'});link(prev,B.id);});
  {const K=PAS_KEY_RANGER,a=ao(NO*3/4),[x0,y0]=at(1075,a),[x1,y1]=at(1175,a);add('kr_0',x0,y0,'small',small('dmg'));link('ward','kr_0');
    add(K.id,x1,y1,'key',{name:K.name,desc:K.t,ks:K.ks});link('kr_0',K.id);}
  // keystone branches: outward from the spoke slots on the diagonals
  [4,10,18,24].forEach((i,n)=>{let prev='o'+i;const K=PAS_KEYS[[0,1,2,3][n]];
    [720,820].forEach((r,j)=>{const [x,y]=at(r,ao(i)),id=`k${i}_${j}`;add(id,x,y,'small',small(j?'dmg':ringSmall(i)));link(prev,id);prev=id;});
    const [x,y]=at(940,ao(i));add(K.id,x,y,'key',{name:K.name,desc:K.t,ks:K.ks,soon:K.soon});link(prev,K.id);});
  // inner branches: top and bottom of the inner ring, towards the middle
  [[4,PAS_NOTABLE.inner[0]],[12,PAS_NOTABLE.inner[1]]].forEach(([k,B])=>{let prev='i'+k;const a=ai(k);
    [235,175].forEach((r,j)=>{const [x,y]=at(r,a+(j?0.32:0.2)),id=`h${k}_${j}`;add(id,x,y,'small',small(B.sm[j]));link(prev,id);prev=id;});
    const [x,y]=at(140,a+0.5);add(B.id,x,y,'notable',{name:B.name,st:B.st});link(prev,B.id);});
  PAS_EDGES=E;}
pasBuild();
const pasStart=c=>c.cls==='arcanist'?'o0':c.cls==='ranger'?'o21':'o'+14; // the Ranger: the bottom (his own start node since v1.0.132)
// ---------- points ----------
const bossBits=c=>{let n=0;for(let k=0;k<PAS_ACTS;k++)if((c.pasBoss||0)&1<<k)n++;return n;};
const pasEarned=c=>Math.max(0,(c.lvl||1)-1)+PAS_BOSS_PTS*bossBits(c)+(c.para||0);
const pasSpent=c=>c.pas&&Array.isArray(c.pas.n)?c.pas.n.length:0;
const pasFree=c=>Math.max(0,pasEarned(c)-pasSpent(c));
// v13: an empty tree, and act bosses already beaten (worked out from how far the hero got) count as first kills.
function fixPassives(c){
  if(!c.pas||typeof c.pas!=='object'||!Array.isArray(c.pas.n))c.pas={n:[],ch:{}};
  if(!c.pas.ch||typeof c.pas.ch!=='object')c.pas.ch={};
  c.pas.n=c.pas.n.filter((id,i,a)=>PAS_NODES[id]&&id!==pasStart(c)&&a.indexOf(id)===i); // nodes that no longer exist are refunded
  for(const id of Object.keys(c.pas.ch))if(!c.pas.n.includes(id)||!PAS_NODES[id].opts||!PAS_NODES[id].opts[c.pas.ch[id]])delete c.pas.ch[id];
  if(typeof c.pasBoss!=='number'){let b=0;const all=c.won||(c.diffDone||0)>=1||(c.diff||0)>0;
    for(let k=0;k<PAS_ACTS;k++)if(all||(c.maxDepth||1)>5*(k+1))b|=1<<k;c.pasBoss=b;}
  return c.pas;}
// An act boss dies (game.js killEnemy): the first kill of each act's boss gives PAS_BOSS_PTS points.
function pasBossKill(e){const c=G.char;if(!c||e.ab||!(e.kind>=0&&e.kind<PAS_ACTS))return;const bit=1<<e.kind;
  if((c.pasBoss||0)&bit)return;c.pasBoss=(c.pasBoss||0)|bit;
  toast(`+${PAS_BOSS_PTS} passive points`,`First kill of ${e.name||'the act boss'} · ${pasFree(c)} to spend`);}
// ---------- taking nodes ----------
const pasHas=(c,id)=>id===pasStart(c)||!!(c.pas&&c.pas.n.includes(id));
const pasNext=(c,id)=>!pasHas(c,id)&&PAS_NODES[id].adj.some(a=>pasHas(c,a)); // touches what you have
// Why a node can't be taken right now ('' = it can).
function pasWhyNot(c,id){const N=PAS_NODES[id];if(!N)return 'No such node';if(pasHas(c,id))return 'Taken';if(N.soon)return 'Coming in the next update';
  if(!pasNext(c,id))return 'Take a node next to it first';if(!pasFree(c))return 'No passive points left';return '';}
function pasTake(c,id,opt){if(pasWhyNot(c,id))return false;const N=PAS_NODES[id];if(N.opts&&!N.opts[opt|0])return false;
  if(!c.pas)fixPassives(c);c.pas.n.push(id);if(N.opts)c.pas.ch[id]=opt|0;
  if(G.char===c){refreshStats();saveChar();}return true;}
// ---------- refunds (v1.0.107, PoE2 style: gold per node, no free full reset) ----------
// A node can be taken back when everything else you have still connects to your start. Choice nodes: take it back
// and take it again to pick another bonus.
const pasRefundCost=c=>{const L=c.lvl||1;return Math.round(20+12*L+0.4*L*L+20*(c.para||0));};
function pasStillLinked(c,without){const st=pasStart(c),keep=new Set(c.pas.n.filter(id=>id!==without)),seen=new Set([st]),q=[st];
  while(q.length)for(const a of PAS_NODES[q.shift()].adj)if(keep.has(a)&&!seen.has(a)){seen.add(a);q.push(a);}return seen.size===keep.size+1;}
function pasRefundWhyNot(c,id){if(id===pasStart(c))return 'Your starting point';if(!c.pas||!c.pas.n.includes(id))return 'Not taken';
  if(!pasStillLinked(c,id))return 'Take back the nodes beyond it first';if((c.gold||0)<pasRefundCost(c))return `Needs ${pasRefundCost(c)} gold`;return '';}
function pasRefund(c,id){if(pasRefundWhyNot(c,id))return false;c.gold-=pasRefundCost(c);c.pas.n=c.pas.n.filter(x=>x!==id);delete c.pas.ch[id];
  if(G.char===c){refreshStats();saveChar();}return true;}
// ---------- stats ----------
const pasKey=(k,cls)=>k==='aspd'||k==='cspd'?(cls==='arcanist'?'cspd':'aspd'):k; // the Warden and the Ranger: Attack Speed // speed: the hero's own speed stat
const pasNodeStats=(c,id)=>{const N=PAS_NODES[id];if(!N)return [];if(N.opts)return N.opts[(c.pas&&c.pas.ch[id])|0].st;return N.st||[];};
function pasStats(c,s){s.ks={};if(!c.pas)return;let arm=0;
  for(const id of c.pas.n){const N=PAS_NODES[id];if(N&&N.ks)s.ks[N.ks]=true;
    for(const [k0,v] of pasNodeStats(c,id)){const k=pasKey(k0,c.cls);if(k==='spell'&&c.cls!=='arcanist')continue; /* Spell Damage: the Arcanist's */if(k==='armpct')arm+=v;else s[k]=(s[k]||0)+v;}}
  if(arm)s.armor*=1+arm/100;if(s.ks.unwavering)s.dr=(s.dr||0)+10;}
// After every other stat (calcStats, last): keystones that scale the final numbers.
function pasFinal(c,s){const K=s.ks||{};if(K.glass){s.more=(s.more||1)*1.3;s.life*=0.7;}if(K.bloodmagic)s.life*=0.85;
  if(K.overload){for(const k of ['igniteCh','shockCh','poisonCh'])s[k]=Math.min(AIL_CH_CAP,(s[k]||0)*2);s.crit=0;s.noCrit=true;}}
const hasKs=k=>!!(G.stats&&G.stats.ks&&G.stats.ks[k]);
// One stat as text, as the hero would get it.
const PAS_TXT={armpct:'+{v}% Armor',bleed:'+{v}% chance to Bleed',dmg:'+{v}% Damage',petdmg:'+{v}% damage by your wolf and hawk'};
function pasStatText([k0,v],cls){const k=pasKey(k0,cls),t=PAS_TXT[k]||(AFF[k]&&AFF[k].t)||k;return t.replace('{v}',v);}
// Point Blank (v1.0.132): by how far the projectile flew (shoot() keeps where it started)
function pointBlankMul(q){if(!hasKs('pointblank')||q.sx==null)return 1;const d=Math.hypot(q.x-q.sx,q.y-q.sy);
  return d<=150?1.4:d>=450?0.7:1.4-0.7*(d-150)/300;}
