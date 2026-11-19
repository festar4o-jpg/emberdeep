'use strict';
// HUD, input, menus, inventory, merchant, skills panel, title and character creation.
// ---------- HUD ----------
let skillEls=[];
function buildSkillBar(){
  const box=$('skills');
  // Only rebuild when the class changes; rebuilding mid-press (level-up) left held[] stuck on desktop.
  if(box.dataset.cls===G.char.cls+SETTINGS.lefty&&skillEls.length){$('skDot').classList.toggle('hidden',!canLearnAny());return;}
  box.dataset.cls=G.char.cls+SETTINGS.lefty;box.innerHTML='';skillEls=[];held.fill(false);const sk=SKILLS[G.char.cls];
  const pos=[null,[132,14],[116,73],[73,116],[14,132]];
  for(let i=0;i<5;i++){const d=document.createElement('div');d.className='sk pe'+(i===0?' big':'');d.innerHTML=sk[i].icon+'<div class="cd"></div><span class="cdt"></span>';
    if(i>0){d.style[SETTINGS.lefty?'left':'right']=pos[i][0]+'px';d.style.bottom=pos[i][1]+'px';}
    const down=ev=>{ev.preventDefault();held[i]=true;d.classList.add('pressed');tryCast(i);};
    const up=ev=>{ev.preventDefault();held[i]=false;d.classList.remove('pressed');};
    d.addEventListener('touchstart',down,{passive:false});d.addEventListener('touchend',up,{passive:false});d.addEventListener('touchcancel',up,{passive:false});
    d.addEventListener('mousedown',down);d.addEventListener('mouseup',up);d.addEventListener('mouseleave',up);
    box.appendChild(d);skillEls.push(d);}
  $('skDot').classList.toggle('hidden',!canLearnAny());
}
function canLearnAny(){const c=G.char;if(c.skillPts<=0)return false;return SKILL_REQ.some((r,i)=>c.lvl>=r&&c.skills[i]<15);}
function updateHud(){
  const p=G.p,s=G.stats,c=G.char,C=CLASSES[c.cls];
  $('nmTxt').textContent=`${c.name} · Lv ${c.lvl} ${C.name}`;
  // life / resource bars fill from the left; life pulses below 30%
  const hpF=clamp(p.hp/s.life,0,1);
  $('hpb').firstElementChild.style.width=hpF*100+'%';$('hpb').lastElementChild.textContent=`${Math.ceil(Math.max(0,p.hp))} / ${Math.round(s.life)}`;
  $('hpb').classList.toggle('low',hpF<0.3&&!p.dead);
  $('mpb').firstElementChild.style.width=clamp(p.res/s.res*100,0,100)+'%';$('mpb').lastElementChild.textContent=`${Math.floor(p.res)} / ${Math.round(s.res)}`;
  $('hpb').title=`Life ${Math.ceil(p.hp)} / ${Math.round(s.life)}`;$('mpb').title=`${C.res} ${Math.floor(p.res)} / ${Math.round(s.res)}`;
  $('dodgeBtn').querySelector('.cd').style.setProperty('--p',p.dodgeCd>0?p.dodgeCd/DODGE_CD:0);
  $('xpb').firstElementChild.style.width=(c.lvl>=50?100:c.xp/xpNeed(c.lvl)*100)+'%';
  const left=G.enemies.filter(e=>!e.dead).length;
  const D=G.depth,where=D>25?`Endless ${D-25} · ${ACTS[actIdx(D)].name}`:`Act ${actIdx(D)+1} · ${ACTS[actIdx(D)].name} ${stageOf(D)}/5`;
  $('depthTxt').textContent=G.inTown?`Town · next: ${where}`:`${where}${D%5===0?' · Boss':''} · ${left} foes`;
  const bt=shrineText();if($('buffTxt').textContent!==bt)$('buffTxt').textContent=bt;
  const sk=SKILLS[c.cls];
  for(let i=0;i<5;i++){const el=skillEls[i];if(!el)continue;const r=rk(i);el.classList.toggle('locked',r<=0);el.classList.toggle('nores',r>0&&p.res<sk[i].cost);
    const f=p.cd[i]>0?p.cd[i]/p.cdMax[i]:0;el.children[0].style.setProperty('--p',f);el.children[1].textContent=(i>0&&p.cd[i]>0.05)?p.cd[i].toFixed(p.cd[i]<1?1:0):'';}
  $('potCnt').textContent=p.potions;$('potBtn').classList.toggle('locked',p.potions<=0);$('potBtn').querySelector('.cd').style.setProperty('--p',p.potCd>0?p.potCd:0);
  const b=G.boss;if(b&&!b.dead&&b.aggro){$('bossbar').classList.remove('hidden');$('bossName').textContent=b.name;$('bossbar').querySelector('i').style.width=(b.hp/b.maxHp*100)+'%';}else $('bossbar').classList.add('hidden');
}
function usePotion(){const p=G.p;if(G.paused||p.dead||p.potions<=0||p.potCd>0||p.hp>=G.stats.life)return;p.potions--;p.potCd=1;healPlayer(G.stats.life*0.45);burst(p.x,p.y,16,'#5f5',120);
  if(hasPw('potionReset')){p.cd.fill(0);floatText(p.x,p.y-40,'Cooldowns reset','#ff9a3a',false);}}

// ---------- input ----------
// Floating joystick: it appears where the thumb lands anywhere in the joystick zone (left 40% of the screen, or the
// right 40% in left-handed mode). Small dead zone, analog speed (a light push walks slowly), and the base follows a
// thumb that slides past the rim. It is released on touchend/touchcancel anywhere, when the touch disappears from
// the screen's touch list (a missed touchend), and on blur / hidden page / orientation change, so it can't get stuck.
const JOY_ZONE=0.4,JOY_DEAD=0.12;
const joyR=()=>JOY_SIZES[SETTINGS.joy]||JOY_SIZES.m; // knob travel in px: full speed at the rim
const inJoyZone=x=>SETTINGS.lefty?x>CW*(1-JOY_ZONE):x<CW*JOY_ZONE;
function joyStart(id,x,y){if(joy.active||!inJoyZone(x))return false;const R=joyR(),m=R*1.2+6; // keep the whole base on screen
  joy.active=true;joy.id=id;joy.ox=clamp(x,m,CW-m);joy.oy=clamp(y,m,CH-m);joy.dx=joy.dy=0;placeJoy(true);joyMove(x,y);return true;}
function joyMove(x,y){const R=joyR(),m=R*1.2+6;let vx=x-joy.ox,vy=y-joy.oy,l=Math.hypot(vx,vy);
  if(l>R){joy.ox=clamp(joy.ox+vx/l*(l-R),m,CW-m);joy.oy=clamp(joy.oy+vy/l*(l-R),m,CH-m);placeJoy(true); // drag the base along (staying on screen)
    vx=x-joy.ox;vy=y-joy.oy;l=Math.hypot(vx,vy);if(l>R){vx*=R/l;vy*=R/l;l=R;}}
  const n=l/R,mag=n<JOY_DEAD?0:Math.min(1,(n-JOY_DEAD)/(1-JOY_DEAD)); // dead zone, then 0..1 analog
  joy.dx=l?vx/l*mag:0;joy.dy=l?vy/l*mag:0;$('knob').style.transform=`translate(${vx}px,${vy}px)`;}
function joyEnd(){joy.active=false;joy.id=null;joy.dx=joy.dy=0;placeJoy(null);}
const hasTouch=(list,id)=>{for(const t of list)if(t.identifier===id)return true;return false;};
cv.addEventListener('touchstart',ev=>{ev.preventDefault();if(joy.active&&joy.id!=null&&!hasTouch(ev.touches,joy.id))joyEnd(); // lost its touchend
  for(const t of ev.changedTouches)joyStart(t.identifier,t.clientX,t.clientY);},{passive:false});
addEventListener('touchmove',ev=>{if(!joy.active||joy.id==null)return;if(!hasTouch(ev.touches,joy.id)){joyEnd();return;}
  for(const t of ev.changedTouches)if(t.identifier===joy.id)joyMove(t.clientX,t.clientY);},{passive:true});
const joyTouchEnd=ev=>{if(joy.id==null)return;if(hasTouch(ev.changedTouches,joy.id)||!hasTouch(ev.touches,joy.id))joyEnd();};
addEventListener('touchend',joyTouchEnd);addEventListener('touchcancel',joyTouchEnd);
addEventListener('blur',()=>releaseInputs());addEventListener('pagehide',()=>releaseInputs());
let mouseJoy=false;
cv.addEventListener('mousedown',ev=>{if(joyStart('mouse',ev.clientX,ev.clientY))mouseJoy=true;});
addEventListener('mousemove',ev=>{if(mouseJoy)joyMove(ev.clientX,ev.clientY);});
addEventListener('mouseup',()=>{if(mouseJoy){mouseJoy=false;joyEnd();}});
addEventListener('keydown',ev=>{if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
  if(!$('startOv').classList.contains('hidden')){if(ev.code==='Enter'||ev.code==='Space'){ev.preventDefault();startTap();}return;} // start screen: Enter/Space = tap
  keys[ev.code]=true;
  if(!G.char||!G.p)return;
  if(ev.code==='KeyQ')usePotion();if(ev.code==='Space'||ev.code==='ShiftLeft'||ev.code==='ShiftRight'){ev.preventDefault();tryDodge();}if(ev.code==='KeyI')toggleInv();if(ev.code==='KeyK')toggleSkills();
  if(ev.code==='KeyE'){if(G.nearFeat)useFeature();else if(!$('shopBtn').classList.contains('hidden'))openShop();else if(!$('stashBtn').classList.contains('hidden'))openStash();else if(!$('smithBtn').classList.contains('hidden'))openSmith();else if(!$('descBtn').classList.contains('hidden'))descend();}
  if(ev.code==='Escape'){if(!$('bookOv').classList.contains('hidden'))closeBook();else if(!$('smithAsk').classList.contains('hidden'))cancelBulk();else if(!$('pouchOv').classList.contains('hidden'))closePouch();else if(!$('itemOv').classList.contains('hidden'))closeItem();else if(!$('shopOv').classList.contains('hidden'))closeShop();else if(!$('stashOv').classList.contains('hidden'))closeStash();else if(!$('smithOv').classList.contains('hidden'))closeSmith();else if(!$('invOv').classList.contains('hidden'))toggleInv();else if(!$('skOv').classList.contains('hidden'))toggleSkills();else toggleMenu();}});
addEventListener('keyup',ev=>{keys[ev.code]=false;});
// Losing focus (alt-tab, notification, app switch) swallows keyup/mouseup — release all inputs.
function releaseInputs(){for(const k in keys)keys[k]=false;held.fill(false);skillEls.forEach(el=>el.classList.remove('pressed'));mouseJoy=false;joyEnd();}
addEventListener('blur',releaseInputs);
const tap=(id,fn)=>$(id).addEventListener('click',fn);
$('potBtn').addEventListener('touchstart',ev=>{ev.preventDefault();usePotion();},{passive:false});$('potBtn').addEventListener('mousedown',usePotion);
$('dodgeBtn').addEventListener('touchstart',ev=>{ev.preventDefault();tryDodge();},{passive:false});$('dodgeBtn').addEventListener('mousedown',()=>tryDodge());
tap('descBtn',descend);
function descend(){if(G.paused||!G.portal.active)return;if(G.inTown)startDepth(G.depth);else startTown(G.depth+1);}
tap('shopBtn',openShop);
tap('bagBtn',toggleInv);tap('skBtn',toggleSkills);tap('menuBtn',toggleMenu);
tap('resumeBtn',toggleMenu);
tap('quitBtn',()=>{saveChar();G.paused=true;G.char=null;G.p=null;G.mapCv=null;$('menuOv').classList.add('hidden');$('hud').classList.add('hidden');showTitle();});
tap('actOv',hideActTitle);
function showVictory(){const c=G.char;
  $('winStats').innerHTML=[['Hero',`${esc(c.name)}, Level ${c.lvl} ${CLASSES[c.cls].name}`],['Monsters slain',c.kills||0],['Deaths',c.deaths||0],['Gold',c.gold]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('winOv').classList.remove('hidden');releaseInputs();setPause();}
tap('winGo',()=>{$('winOv').classList.add('hidden');setPause();toast('The portal is open','Step through to enter the Endless Depths');});
tap('winExit',()=>{$('winOv').classList.add('hidden');setPause();$('quitBtn').click();});
tap('respawnBtn',()=>{$('deathOv').classList.add('hidden');G.char.deaths=(G.char.deaths||0)+1;G.char.gold=Math.floor(G.char.gold*0.9);startDepth(G.depth);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseInputs();saveChar();if(G.char&&!G.paused)toggleMenu();}});
function anyPanel(){return ['invOv','skOv','menuOv','itemOv','deathOv','shopOv','stashOv','smithOv','smithAsk','pouchOv','bookOv','actOv','winOv'].some(i=>!$(i).classList.contains('hidden'));}
function setPause(){const panel=anyPanel();G.paused=panel||!G.char;for(let i=0;i<5;i++)held[i]=false;if(panel)G.texts=[];}
let actTimer=0;
function showActTitle(d){const A=ACTS[actIdx(d)],cy=cycleOf(d);
  $('actN').textContent=d>25?'THE ENDLESS DEPTHS':'ACT '+roman(actIdx(d)+1);$('actT').textContent=A.name;$('actS').textContent=d>25?`Endless ${d-25}: the deep grows stronger`:A.sub;
  const o=$('actOv');o.style.setProperty('--act',A.col);o.classList.remove('hidden');releaseInputs();setPause();clearTimeout(actTimer);actTimer=setTimeout(hideActTitle,3800);}
function hideActTitle(){clearTimeout(actTimer);const o=$('actOv');if(o.classList.contains('hidden'))return;o.classList.add('hidden');setPause();}
function toggleMenu(){if(!G.char)return;$('menuOv').classList.toggle('hidden');if(!$('menuOv').classList.contains('hidden')){renderFilter();renderSettings();}setPause();}
// Loot filter controls in the menu (see lootHidden).
const FILTER_OPTS=[[0,'Off'],['auto','Auto'],[2,'II'],[3,'III'],[4,'IV'],[5,'V']];
function setFilter(ch){const c=G.char;c.filter=Object.assign({min:0,rares:true},c.filter,ch);saveChar();renderFilter();}
function renderFilter(){
  const c=G.char,f=Object.assign({min:0,rares:true},c.filter),min=filterMin(c);
  $('filtTier').innerHTML=FILTER_OPTS.map(([v,n])=>`<div class="tab${f.min===v?' on':''}">${n}</div>`).join('');
  [...$('filtTier').children].forEach((el,i)=>el.onclick=()=>setFilter({min:FILTER_OPTS[i][0]}));
  $('filtRare').classList.toggle('on',f.rares!==false);$('filtRare').onclick=()=>setFilter({rares:f.rares===false});
  $('filtSalv').classList.toggle('on',!!f.autoSalv);$('filtSalv').onclick=()=>setFilter({autoSalv:!f.autoSalv});
  const hidden=G.loot.filter(l=>l.item&&!l.taken&&lootHidden(l.item)).length;
  $('filtInfo').textContent=!f.min?'Showing every item.':min<=1?'Auto hides items more than one tier below the act you are in. Nothing to hide yet.':
    `Hiding Tier ${TIER_NAME.slice(0,min-1).join(', ')} ${f.rares!==false?'white and magic items':'items'}${f.min==='auto'?` (auto: you're in Tier ${TIER_NAME[dropAct(G.depth)-1]} lands)`:''}. Rings, amulets and socketed items always show.`+(hidden?` ${hidden} hidden here.`:'');
}

// ---------- inventory UI ----------
function cellHtml(it,label,sl){if(!it)return `<div class="cell empty">${sl?slotIcon(sl,G.char.cls):''}${label?`<span class="lbl">${label}</span>`:''}</div>`;
  const better=!label&&isBetter(it),other=!label&&it.slot!=='charm'&&!fitsFor(G.char,it).length;return `<div class="cell${other?' other':''}" style="border-color:${RCOL[it.rarity]}">${itemIcon(it)}${it.tier?`<span class="tier">${TIER_NAME[it.tier-1]}</span>`:''}${it.sockets?`<span class="socks">${'●'.repeat((it.socketed||[]).length)}${'○'.repeat(freeSockets(it))}</span>`:''}${it.upg?`<span class="up">+${it.upg}</span>`:''}${it.lock?'<span class="lock">🔒</span>':''}${better?'<span class="better">▲</span>':''}${label?`<span class="lbl">${label}</span>`:''}</div>`;}
function isBetter(it){const c=G.char;return power(calcStats(c,it))>power(calcStats(c))*1.01;}
function toggleInv(){if(!G.char)return;const o=$('invOv');o.classList.toggle('hidden');if(!o.classList.contains('hidden')){$('bagDot').classList.add('hidden');renderInv();}setPause();}
function renderInv(){
  const c=G.char,s=G.stats;
  const twoH=is2h(c.equip.mainhand);
  $('eqgrid').innerHTML=EQ_SLOTS.map(sl=>sl==='offhand'&&twoH?`<div class="cell empty blocked">${itemIcon(c.equip.mainhand)}<span class="lbl">Off Hand</span><span class="tag">2H</span></div>`:setCell(c,sl)).join('');
  [...$('eqgrid').children].forEach((el,i)=>el.onclick=()=>{const sl=EQ_SLOTS[i],it=c.equip[sl];if(sl==='offhand'&&twoH){toast('Off Hand blocked','Your two-handed weapon needs both hands');return;}if(it)openItem(it,sl);});
  const avg=Math.round((s.dmin+s.dmax)/2*s.levelMul*(1+s.dmg/100));
  const red=Math.round(Math.min(0.75,s.armor/(s.armor+30+10*G.depth))*100);
  $('statsum').innerHTML=[['Damage',avg],['Life',Math.round(s.life)],['Armor',`${Math.round(s.armor)} (${red}%)`],['Block',Math.round(s.block)+'%'],['Crit',s.crit.toFixed(1)+'%'],['Crit Dmg','+'+Math.round(s.critd)+'%'],['Attacks/s',(1/skillCd(0)).toFixed(2)],['Atk Speed','+'+Math.round(s.aspd)+'%'],['Cooldown','-'+Math.round(s.cdr)+'%'],['Move','+'+Math.round(s.move)+'%'],['Life on Hit',Math.round(s.loh)],['Regen',s.regen.toFixed(1)+'/s'],['Potions',`${potFloor()} (max ${potMax()})`]].concat(s.spell?[['Spell Dmg','+'+Math.round(s.spell)+'%']]:[],s.gold?[['Gold Found','+'+Math.round(s.gold)+'%']]:[],s.loot?[['Item Drops','+'+Math.round(s.loot)+'%']]:[],s.bleed?[['Bleed',Math.round(s.bleed)+'%']]:[],s.stunCh?[['Stun',Math.round(s.stunCh)+'%']]:[],s.oh?[['Dual Wield','+15% rate']]:[]).map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('goldv').textContent=c.gold;$('bagCount').textContent=`${c.bag.length}/30`;
  const cells=[];for(let i=0;i<Math.max(30,c.bag.length);i++)cells.push(cellHtml(c.bag[i]));$('bag').innerHTML=cells.join('');
  [...$('bag').children].forEach((el,i)=>el.onclick=()=>{if(c.bag[i])openItem(c.bag[i],false);});
  renderCharms();
}
// Equipment cell; worn set pieces glow in their set's colour while its bonus is on (brighter with the full set).
function setCell(c,sl){const it=c.equip[sl],g=it?setGlow(it,c):'',h=cellHtml(it,SLOT_NAME[sl],sl);if(!g)return h;
  const S=SETS[setOf(it)]; // the glow takes the set's aura colour (CSS variable --sg)
  return h.replace('<div class="cell',`<div title="${esc(S.name)}: ${g==='full'?'full set':'set bonus'} active" class="cell sglow${g==='full'?' full':''}`).replace(' style="',` style="--sg:${S.aura||'63,224,90'};`);}
function salvageValue(it){return Math.round((it.ilvl*3+5)*([1,2,5,12,15,12][it.rarity]||1));}
function upgradeCost(it){return Math.round((20+it.ilvl*8)*Math.pow(1.6,it.upg||0));}
tap('salvAll',()=>{const c=G.char;let g=0,n=0;const got={};c.bag=c.bag.filter(it=>{if(it.rarity<=1&&!it.sockets&&it.slot!=='charm'&&!it.lock){g+=salvageValue(it);addMats(got,grantSalvage(c,it));n++;return false;}return true;}); /* locked items, socketed bases and charms are kept */c.gold+=g;if(n)toast(`Salvaged ${n} items`,`+${g} gold ${matText(got)}`);renderInv();saveChar();});
tap('invClose',toggleInv);
// equipped: the slot key the item is worn in, or false for bag/shop items.
// A set piece's set: its pieces (worn ones lit) and bonuses (active ones lit).
// The piece's own set lines first, then the set: pieces (green worn, gray missing) and its bonuses (green when on).
function setHtml(it,c){const v=setView(it,c);
  return v.own.map(o=>`<div class="iown${o.on?' on':''}">${esc(o.text)} <small>(${o.need} set)</small></div>`).join('')+
    `<div class="iset"><div class="sname">${esc(v.name)} <span class="fdim">(${v.n}/${v.total} worn)</span></div>`+v.pieces.map(p=>`<div class="spc${p.worn?' on':''}">${p.worn?'●':'○'} ${esc(p.name)}</div>`).join('')+
    v.bonus.map(b=>`<div class="sbon${b.on?' on':''}">${b.full?'Full set':`(${b.need})`}: ${esc(b.text)}</div>`).join('')+'</div>';}
// A unique power line (orange); class powers on another class's character are marked as inactive.
function powerHtml(k,c){const P=UPOW[k],off=P.cls&&P.cls!==c.cls;return `<div class="ipow${off?' off':''}">✦ ${esc(P.t)}${off?` <small>(${CLASSES[P.cls].name} only)</small>`:''}</div>`;}
function openItem(it,equipped,price){
  if(it.slot==='charm'&&price==null)return openCharm(it,equipped==='charm');
  const c=G.char;
  const card=x=>{const mm=1+0.1*(x.upg||0);let h=`<div class="card" style="border-color:${RCOL[x.rarity]}"><div class="chead"><div class="cicon">${itemIcon(x)}</div><div><div class="iname" style="color:${RCOL[x.rarity]}">${esc(x.name)}${x.upg?' +'+x.upg:''}</div><div class="isub">${RNAME[x.rarity]} ${typeLabel(x)}${x.tier?' · '+tierLabel(x):''} · Item level ${x.ilvl}${(x.slot==='weapon'||x.slot==='shield'||x.slot==='focus')&&x.cls&&x.cls!==c.cls?` · <span style="color:#e07a5a">${CLASSES[x.cls].name} item</span>`:''}</div></div></div>`;
    if(x.slot==='weapon'){const w=wOf(x);h+=`<div class="ibase">Damage: ${Math.round(x.dmin*mm)}–${Math.round(x.dmax*mm)}</div><div class="ibase">Attack Rate: ${w.spd.toFixed(2)}×</div>`;
      for(const t of weaponProps(w))if(!(w.skill&&t.includes('random skill')))h+=`<div class="ibase">${t}</div>`; // the rolled skill shows below as an implicit
      if(w.arc)h+=`<div class="ibase">Cleave arc: ${w.arc>=1.4?'Very wide':w.arc>=1?'Normal':'Narrow'}</div>`;
      if(w.hands===2)h+=`<div class="ibase" style="color:var(--dim)">Two-handed: blocks the Off Hand</div>`;}
    if(x.arm)h+=`<div class="ibase">Armor: ${Math.round(x.arm*mm)}</div>`;
    for(const a of x.imp||[])h+=`<div class="ibase">${esc(affText(a,mm,x.cls||c.cls))}</div>`;
    for(const a of x.affs)h+=`<div class="iaff${a.k==='skill'?' skl':''}">${esc(affText(a,mm,x.cls||c.cls))}</div>`;
    for(const k of itemPowers(x))h+=powerHtml(k,c);
    if(setOf(x))h+=setHtml(x,c);
    if(x.sockets){const sk=x.socketed||[],hs=hostOf(x);h+=`<div class="sockrow">${Array.from({length:x.sockets},(_,i)=>sk[i]?`<span class="sock">${stoneSvg(sk[i])}</span>`:'<span class="sock empty"></span>').join('')}<span class="fdim">${sk.length}/${x.sockets} sockets</span></div>`;
      for(const sg of sk)h+=`<div class="isock"><span style="color:${stoneCol(sg)}">${esc(stoneName(sg))}</span>: ${esc(statText(stoneStat(sg,hs)))}</div>`;}
    return h+'</div>';};
  let h=card(it);
  const fits=fitsFor(c,it),target=equipped?null:bestSlot(c,it),multi=fits.length>1;
  if(!equipped&&!fits.length)h+=`<div class="cmp dn">${CLASSES[c.cls].name}s can't use this. Salvage or sell it.</div>`;
  else if(!equipped&&!target)h+=`<div class="cmp dn">Your two-handed weapon blocks the Off Hand.</div>`;
  if(!equipped&&target){const cur=c.equip[target];
    if(cur)h+=`<div class="isub" style="margin:4px 0">Currently equipped${multi?' ('+SLOT_NAME[target]+')':''}:</div>`+card(cur);
    if(is2h(it)&&c.equip.offhand)h+=`<div class="isub" style="margin:4px 0">Also unequips your Off Hand:</div>`+card(c.equip.offhand);
    const s0=calcStats(c),s1=calcStats(c,it,target);
    const lines=[['Damage',x=>(x.dmin+x.dmax)/2*x.levelMul*(1+x.dmg/100)],['Life',x=>x.life],['Armor',x=>x.armor],['Block %',x=>x.block],['Crit %',x=>x.crit],['Crit Dmg %',x=>x.critd],['Atk Rate %',x=>x.wspd*(1+x.aspd/100)*100],['Spell Dmg %',x=>x.spell],['Bleed %',x=>x.bleed],['Stun %',x=>x.stunCh],['Splash %',x=>x.splash],['Pierce',x=>x.pierce],['Slain explode %',x=>x.explode],['Cooldown %',x=>x.cdr],['Move %',x=>x.move],['Life on Hit',x=>x.loh],['Regen',x=>x.regen],['Max '+CLASSES[c.cls].res,x=>x.res],['Potion Charges',x=>x.pot]];
    let cmp='';for(const [n,f] of lines){const d=f(s1)-f(s0);if(Math.abs(d)>=0.1)cmp+=`<div class="${d>0?'up':'dn'}">${d>0?'▲ +':'▼ '}${Math.abs(d)<10?d.toFixed(1):Math.round(d)} ${n}</div>`;}
    s1.skill.forEach((v,i)=>{const d=v-s0.skill[i];if(d)cmp+=`<div class="${d>0?'up':'dn'}">${d>0?'▲ +':'▼ '}${d} ${SKILLS[c.cls][i].name}</div>`;});
    h+=`<div class="cmp"><b>If equipped${multi?' in '+SLOT_NAME[target]:''}:</b>${cmp||'<div>No change</div>'}</div>`;}
  if(price!=null){ // shop listing: buy or close only
    h+=`<div class="row"><div class="btn sm${c.gold<price?' dis':''}" id="iBuy">Buy (${price}🪙)</div><div class="btn sm" id="iClose">Close</div></div>`;
    $('itemPanel').innerHTML=h;$('itemOv').classList.remove('hidden');setPause();
    $('iBuy').onclick=()=>buyItem(it,price);$('iClose').onclick=closeItem;return;}
  const cost=upgradeCost(it);
  const eqOk=sl=>is2h(it)||slotOpen(c.equip,sl);
  const equipBtns=!fits.length?'':multi?fits.map(sl=>`<div class="btn sm${eqOk(sl)?'':' dis'}" data-eq="${sl}">Equip ${SLOT_NAME[sl]}</div>`).join(''):`<div class="btn sm${eqOk(fits[0])?'':' dis'}" data-eq="${fits[0]}">Equip</div>`;
  h+=`<div class="row">${equipped?'<div class="btn sm" id="iUnequip">Unequip</div>':equipBtns}
    <div class="btn sm${(it.upg||0)>=10||c.gold<cost?' dis':''}" id="iUpg">Upgrade +${(it.upg||0)+1} (${cost}🪙)</div>
    ${freeSockets(it)>0&&it.rarity!==4?`<div class="btn sm" id="iSock">💎 Socket (${freeSockets(it)} free)</div>`:''}
    ${it.socketed&&it.socketed.length&&!it.rb?`<div class="btn sm${G.inTown&&c.gold>=unsocketCost(it)?'':' dis'}" id="iUnsock">Unsocket (${unsocketCost(it)}🪙)</div>`:''}
    <div class="btn sm" id="iLock">${it.lock?'🔓 Unlock':'🔒 Lock'}</div>
    ${equipped?'':`<div class="btn sm red${it.lock?' dis':''}" id="iSalv">Salvage (+${salvageValue(it)}🪙)</div>`}
    <div class="btn sm" id="iClose">Close</div></div>`;
  $('itemPanel').innerHTML=h;$('itemOv').classList.remove('hidden');setPause();
  const after=()=>{refreshStats();renderInv();saveChar();};
  if(equipped)$('iUnequip').onclick=()=>{if(c.bag.length>=30){toast('Bag is full');return;}c.equip[equipped]=null;c.bag.push(it);closeItem();after();};
  else{$('itemPanel').querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>{const sl=b.dataset.eq,cur=c.equip[sl];if(!eqOk(sl))return;
      const drop=sl==='mainhand'&&is2h(it)?c.equip.offhand:null; // a two-hander frees the off hand
      if(c.bag.length-1+(cur?1:0)+(drop?1:0)>30){toast('Bag is full','Make room for your Off Hand item');return;}
      c.bag.splice(c.bag.indexOf(it),1);if(cur)c.bag.push(cur);if(drop){c.bag.push(drop);c.equip.offhand=null;}c.equip[sl]=it;closeItem();after();});
    $('iSalv').onclick=()=>{const r=salvageItem(c,it);if(!r)return;toast('Salvaged',`+${r.gold} gold ${matText(r.mats)}`);closeItem();after();};}
  $('iLock').onclick=()=>{toggleLock(it);renderInv();openItem(it,equipped);};
  if($('iSock'))$('iSock').onclick=()=>{closeItem();openPouch({it,eq:equipped});};
  if($('iUnsock'))$('iUnsock').onclick=()=>{if(!G.inTown){toast('Unsocket in town','The merchant can pry them loose');return;}if(unsocket(it)){after();openItem(it,equipped);}};
  $('iUpg').onclick=()=>{if((it.upg||0)>=10||c.gold<cost)return;c.gold-=cost;it.upg=(it.upg||0)+1;after();openItem(it,equipped);};
  $('iClose').onclick=closeItem;
}
function closeItem(){$('itemOv').classList.add('hidden');setPause();}

// ---------- merchant ----------
function potionPrice(){return 20+G.depth*4;}
function rollShop(d){
  const c=G.char,out=[];
  for(const t of typesFor(c.cls).sort(()=>Math.random()-0.5).slice(0,8)){const it=genItem(d,c.cls,1,t,1);out.push({it,price:Math.round(salvageValue(it)*4*rand(0.9,1.1))});}
  return out.sort((a,b)=>TYPE_KEYS.indexOf(a.it.slot)-TYPE_KEYS.indexOf(b.it.slot)||a.it.rarity-b.it.rarity);
}
function openShop(){if(!G.char||G.paused||!G.inTown)return;$('shopOv').classList.remove('hidden');renderShop();setPause();}
function closeShop(){$('shopOv').classList.add('hidden');setPause();}
function renderShop(){
  const c=G.char,p=G.p,pp=potionPrice();
  $('shopGold').textContent=c.gold;$('shopBag').textContent=`Bag ${c.bag.length}/30`;
  $('potInfo').textContent=`You carry ${p.potions}/${potMax()}`;
  const pb=$('buyPot');pb.textContent=p.potions>=potMax()?'Full':`Buy (${pp}🪙)`;pb.classList.toggle('dis',c.gold<pp||p.potions>=potMax());
  const grid=$('shopGrid');
  if(!G.shop.length){grid.innerHTML='<p class="sub" style="grid-column:1/-1">Sold out — come back next time.</p>';return;}
  grid.innerHTML=G.shop.map(w=>`<div class="cell" style="border-color:${RCOL[w.it.rarity]}">${itemIcon(w.it)}${isBetter(w.it)?'<span class="better">▲</span>':''}<span class="price${c.gold<w.price?' no':''}">${w.price}</span></div>`).join('');
  [...grid.children].forEach((el,i)=>el.onclick=()=>{const w=G.shop[i];if(w)openItem(w.it,false,w.price);});
}
tap('buyPot',()=>{const c=G.char,p=G.p,pp=potionPrice();if(c.gold<pp||p.potions>=potMax())return;c.gold-=pp;p.potions++;renderShop();saveChar();});
function buyItem(it,price){
  const c=G.char;if(c.gold<price)return;
  if(c.bag.length>=30){toast('Bag is full','Salvage items in 🎒');return;}
  const i=G.shop.findIndex(w=>w.it===it);if(i<0)return;
  c.gold-=price;G.shop.splice(i,1);c.bag.push(it);noteSetPiece(it);
  closeItem();renderShop();saveChar();toast('Purchased',it.name);
}
tap('shopClose',closeShop);

// ---------- skills UI ----------
function toggleSkills(){if(!G.char)return;const o=$('skOv');o.classList.toggle('hidden');if(!o.classList.contains('hidden'))renderSkills();setPause();}
function renderSkills(){
  const c=G.char,sk=SKILLS[c.cls];$('skPts').textContent=`Skill points: ${c.skillPts}`;
  $('skList').innerHTML=sk.map((s,i)=>{const base=c.skills[i],bonus=G.stats.skill[i],r=rk(i),req=SKILL_REQ[i];const locked=c.lvl<req;
    const can=!locked&&c.skillPts>0&&base<15;
    return `<div class="skrow${locked?' locked':''}"><div class="ic">${s.icon}</div><div class="info"><b>${s.name}</b> ${base?`Rank ${base}${bonus?` <span style="color:#f2d04a">(+${bonus})</span>`:''}`:locked?`· Requires level ${req}`:'· Not learned'}
      <div>${s.desc(Math.max(1,r))}</div>${base&&base<15?`<div class="nx">Next rank: ${s.desc(r+1)}</div>`:''}${s.cd>=1?`<div>Cooldown ${s.cd}s</div>`:''}</div>
      <div class="btn sm${can?'':' dis'}" data-i="${i}">${base?'+':'Learn'}</div></div>`;}).join('');
  $('skList').querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;if(c.skillPts<=0||c.lvl<SKILL_REQ[i]||c.skills[i]>=15)return;c.skills[i]++;c.skillPts--;renderSkills();buildSkillBar();saveChar();});
}
tap('skClose',toggleSkills);

// ---------- title & creation ----------
let pickCls='warden';
// ---------- fullscreen, landscape, start screen ----------
const docEl=()=>document.documentElement;
const isFullscreen=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
// Home-screen app (display-mode) or the Android app (its WebView adds EmberdeepApp to the user agent): already fullscreen and landscape.
const installedApp=()=>['fullscreen','standalone'].some(m=>matchMedia(`(display-mode: ${m})`).matches)||(typeof navigator!=='undefined'&&/\bEmberdeepApp\b/.test(navigator.userAgent||''));
// Phones held upright see the rotate message (CSS) and the game doesn't run underneath it.
const portraitBlocked=()=>matchMedia('(orientation: portrait) and (pointer: coarse)').matches;
// Fullscreen first (orientation lock needs it on Android), then lock to landscape. Both fail quietly where unsupported (iPhone).
function enterFullscreen(){const el=docEl(),req=el.requestFullscreen||el.webkitRequestFullscreen;let p=null;
  try{if(req&&!isFullscreen())p=req.call(el,{navigationUI:'hide'});}catch(e){}
  Promise.resolve(p).catch(()=>{}).then(lockLandscape);}
function lockLandscape(){try{const o=typeof screen!=='undefined'&&screen.orientation;if(o&&o.lock)o.lock('landscape').catch(()=>{});}catch(e){}}
function exitFullscreen(){const ex=document.exitFullscreen||document.webkitExitFullscreen;try{if(ex&&isFullscreen())Promise.resolve(ex.call(document)).catch(()=>{});}catch(e){}}
function startTap(){enterFullscreen();$('startOv').classList.add('hidden');}
tap('startOv',startTap);
tap('fsBtn',()=>{if(isFullscreen())exitFullscreen();else enterFullscreen();});
const fsLabel=()=>{$('fsBtn').textContent=isFullscreen()?'⛶ Exit fullscreen':'⛶ Fullscreen';};
document.addEventListener('fullscreenchange',fsLabel);document.addEventListener('webkitfullscreenchange',fsLabel);
// turning the phone upright mid-fight lets go of the joystick and buttons
addEventListener('orientationchange',()=>{releaseInputs();setTimeout(resize,200);});
// ---------- settings (shared by all characters) ----------
const SETTINGS_KEY='emberdeep_settings',JOY_SIZES={s:44,m:55,l:68};
let SETTINGS={joy:'m',lefty:false};
function loadSettings(){try{const o=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(o&&typeof o==='object')SETTINGS={joy:JOY_SIZES[o.joy]?o.joy:'m',lefty:o.lefty===true};}catch(e){}applySettings();}
const SETTINGS_NOW=()=>SETTINGS; // (tests: SETTINGS is a let)
function storeSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(SETTINGS));}catch(e){}}
function setSetting(k,v){SETTINGS[k]=v;storeSettings();releaseInputs();applySettings();renderSettings();}
// Left-handed mode mirrors the controls: joystick on the right, skill arc and dodge on the left.
function applySettings(){document.body.classList.toggle('lefty',SETTINGS.lefty);const R=joyR();$('joy').style.setProperty('--jr',R+'px');
  if(G.char&&skillEls.length)buildSkillBar();placeJoy(null);}
function renderSettings(){
  $('setJoy').innerHTML=[['s','Small'],['m','Medium'],['l','Large']].map(([k,n])=>`<div class="tab${SETTINGS.joy===k?' on':''}" data-j="${k}">${n}</div>`).join('');
  $('setJoy').querySelectorAll('[data-j]').forEach(el=>el.onclick=()=>setSetting('joy',el.dataset.j));
  $('setLefty').classList.toggle('on',SETTINGS.lefty);$('setLefty').onclick=()=>setSetting('lefty',!SETTINGS.lefty);}
function showTitle(){
  $('titleOv').classList.remove('hidden');
  $('slots').innerHTML=SAVES.length?SAVES.map((c,i)=>`<div class="slot"><div class="ic">${CLASSES[c.cls].icon}</div><div class="info"><b>${esc(c.name)}</b><div>Level ${c.lvl} ${CLASSES[c.cls].name} · ${ACTS[actIdx(c.depth)].name} ${depthLabel(c.depth)} (best ${depthLabel(c.maxDepth)})</div></div><div class="btn sm" data-play="${i}">Play</div><div class="btn sm red" data-del="${i}">✕</div></div>`).join(''):'<p class="sub">No heroes yet. Create your first one.</p>';
  $('slots').querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>startGame(SAVES[+b.dataset.play]));
  $('slots').querySelectorAll('[data-del]').forEach(b=>{let armed=false;b.onclick=()=>{if(!armed){armed=true;b.textContent='Delete?';setTimeout(()=>{armed=false;b.textContent='✕';},2500);return;}SAVES.splice(+b.dataset.del,1);storeSaves();showTitle();};});
  $('newBtn').classList.toggle('dis',SAVES.length>=6);
}
function renderClassPick(){$('classPick').innerHTML=Object.entries(CLASSES).map(([k,C])=>`<div class="cls${k===pickCls?' sel':''}" data-c="${k}"><div class="ic">${C.icon}</div><b>${C.name}</b><p>${C.desc}</p></div>`).join('');
  $('classPick').querySelectorAll('.cls').forEach(el=>el.onclick=()=>{pickCls=el.dataset.c;renderClassPick();});}
tap('newBtn',()=>{if(SAVES.length>=6)return;$('titleOv').classList.add('hidden');$('createOv').classList.remove('hidden');$('nameIn').value='';renderClassPick();});
tap('createBack',()=>{$('createOv').classList.add('hidden');showTitle();});
tap('createGo',()=>{const name=$('nameIn').value.trim()||CLASSES[pickCls].name;$('nameIn').blur();const c=newChar(name.slice(0,14),pickCls);SAVES.push(c);storeSaves();startGame(c);});
