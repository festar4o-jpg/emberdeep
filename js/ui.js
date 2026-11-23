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
  $('nmTxt').textContent=`${c.name} · Lv ${lvlLabel(c)} ${C.name}`;
  // life / resource bars fill from the left; life pulses below 30%
  const hpF=clamp(p.hp/s.life,0,1);
  $('hpb').firstElementChild.style.height=hpF*100+'%';$('hpb').lastElementChild.innerHTML=`${Math.ceil(Math.max(0,p.hp))}<small>${Math.round(s.life)}</small>`; // current over max: fits the orb
  $('hpb').classList.toggle('low',hpF<0.3&&!p.dead);
  $('mpb').firstElementChild.style.height=clamp(p.res/s.res*100,0,100)+'%';$('mpb').lastElementChild.innerHTML=`${Math.floor(p.res)}<small>${Math.round(s.res)}</small>`;
  $('hpb').title=`Life ${Math.ceil(p.hp)} / ${Math.round(s.life)}`;$('mpb').title=`${C.res} ${Math.floor(p.res)} / ${Math.round(s.res)}`;
  $('dodgeBtn').querySelector('.cd').style.setProperty('--p',p.dodgeCd>0?p.dodgeCd/DODGE_CD:0);
  $('xpb').firstElementChild.style.width=(c.lvl>=MAX_LVL?(c.pxp||0)/paraNeed(c.para||0)*100:c.xp/xpNeed(c.lvl)*100)+'%';$('xpb').classList.toggle('para',c.lvl>=MAX_LVL);
  const left=G.enemies.filter(e=>!e.dead).length;
  const D=G.depth,where=D>25?`Endless ${D-25} · ${ACTS[actIdx(D)].name}`:`${diffTag()}Act ${actIdx(D)+1} · ${ACTS[actIdx(D)].name} ${stageOf(D)}/5`;
  $('depthTxt').textContent=G.zone&&!G.inTown?zoneHud():G.inTown?`${townOf(D).name} · next: ${where}`:`${where} · Lv ${areaLvl(PD())}${D%5===0&&G.levelMode!=='noboss'?' · Boss':''} · ${left} foes`; /* area level (bossfight.js) */
  const bt=shrineText();if($('buffTxt').textContent!==bt)$('buffTxt').textContent=bt;
  const sk=SKILLS[c.cls];
  for(let i=0;i<5;i++){const el=skillEls[i];if(!el)continue;const r=rk(i);el.classList.toggle('locked',r<=0);el.classList.toggle('nores',r>0&&p.res<sk[i].cost);
    const f=p.cd[i]>0?p.cd[i]/p.cdMax[i]:0;el.children[0].style.setProperty('--p',f);el.children[1].textContent=(i>0&&p.cd[i]>0.05)?p.cd[i].toFixed(p.cd[i]<1?1:0):'';}
  $('potCnt').textContent=p.potions;$('potBtn').classList.toggle('locked',p.potions<=0);$('potBtn').querySelector('.cd').style.setProperty('--p',p.potCd>0?p.potCd:0);
  const b=G.boss&&!G.boss.dead?G.boss:G.zboss&&!G.zboss.dead&&G.zboss.aggro?G.zboss:null;if(b&&!b.dead&&b.aggro){$('bossbar').classList.remove('hidden');
    const st=b.transT>0||b.introT>0?'IMMUNE':b.shieldT>0?'SHIELDED':b.staggerT>0?'STAGGERED':b.punishT>0?'EXPOSED':b.enraged?'ENRAGED':''; /* bossfight.js states */
    $('bossName').textContent=b.name+(b.phase!=null?` · Phase ${ROMAN_PH[b.phase]}`:'')+(st?` · ${st}`:'');$('bossbar').querySelector('.bar>i').style.width=(b.hp/b.maxHp*100)+'%';
    $('bossStg').firstElementChild.style.width=(b.staggerT>0?100:Math.min(100,(b.stagger||0)/(b.staggerMax||100)*100))+'%';$('bossStg').classList.toggle('full',b.staggerT>0);}
  else $('bossbar').classList.add('hidden');
}
function usePotion(){const p=G.p;if(G.paused||p.dead||p.potions<=0||p.potCd>0||p.hp>=G.stats.life)return;p.potions--;p.potCd=1;playSfx('potion');healPlayer(G.stats.life*0.45*(1+(G.stats.potheal||0)/100)); /* charms: Potion Healing */burst(p.x,p.y,16,'#5f5',120);
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
  if(ev.code==='KeyE'){if(G.nearFeat)useFeature();else if(!$('shopBtn').classList.contains('hidden'))openShop();else if(!$('stashBtn').classList.contains('hidden'))openStash();else if(!$('smithBtn').classList.contains('hidden'))openSmith();else if(!$('wayBtn').classList.contains('hidden'))openWay();else if(!$('descBtn').classList.contains('hidden'))descend();}
  if(ev.code==='Escape'){if(!$('bookOv').classList.contains('hidden'))closeBook();else if(!$('smithAsk').classList.contains('hidden'))cancelBulk();else if(!$('pouchOv').classList.contains('hidden'))closePouch();else if(!$('itemOv').classList.contains('hidden'))closeItem();else if(!$('shopOv').classList.contains('hidden'))closeShop();else if(!$('stashOv').classList.contains('hidden'))closeStash();else if(!$('smithOv').classList.contains('hidden'))closeSmith();else if(!$('wayOv').classList.contains('hidden'))closeWay();else if(!$('invOv').classList.contains('hidden'))toggleInv();else if(!$('skOv').classList.contains('hidden'))toggleSkills();else toggleMenu();}});
addEventListener('keyup',ev=>{keys[ev.code]=false;});
// Losing focus (alt-tab, notification, app switch) swallows keyup/mouseup — release all inputs.
function releaseInputs(){for(const k in keys)keys[k]=false;held.fill(false);skillEls.forEach(el=>el.classList.remove('pressed'));mouseJoy=false;joyEnd();}
addEventListener('blur',releaseInputs);
const tap=(id,fn)=>$(id).addEventListener('click',fn);
$('potBtn').addEventListener('touchstart',ev=>{ev.preventDefault();usePotion();},{passive:false});$('potBtn').addEventListener('mousedown',usePotion);
$('dodgeBtn').addEventListener('touchstart',ev=>{ev.preventDefault();tryDodge();},{passive:false});$('dodgeBtn').addEventListener('mousedown',()=>tryDodge());
tap('descBtn',descend);
function descend(){if(G.paused)return;if(G.zone&&!G.inTown)return zoneDescend(); /* zones.js */
  if(G.inTown&&G.atTp)return takePortalBack(); /* portal.js */
  if(!G.portal.active)return;if(G.inTown){const z=townGateZone();if(z)startZone(z);else startDepth(G.depth);}else startTown(G.depth+1);}
tap('shopBtn',openShop);
tap('bagBtn',toggleInv);tap('skBtn',toggleSkills);tap('menuBtn',toggleMenu);
tap('resumeBtn',toggleMenu);
tap('quitBtn',()=>{saveChar();G.paused=true;G.char=null;G.p=null;G.mapCv=null;$('menuOv').classList.add('hidden');$('hud').classList.add('hidden');showTitle();});
tap('actOv',hideActTitle);
// d: the difficulty just beaten. Each opens the next one; the endless depths grow to match the highest beaten.
const WIN_TXT=[
  ['ACT V COMPLETE','The Cinder King is ash and the Ember Core falls silent.<br>Yet the dark remembers. <b style="color:#b070ff">Nightmare</b> is open: choose it at any Waystone.<br>Far below, the Endless Depths await.','Descend into the Endless Depths'],
  ['NIGHTMARE CONQUERED','The Cinder King falls a second time, and the world shudders.<br><b style="color:#ff4a3a">Hell</b> is open at every Waystone.<br>The Endless Depths now run as deep as Nightmare.','Descend into the Endless Depths'],
  ['HELL CONQUERED','Nothing is left to burn. You walked through Hell and out again.<br>The Endless Depths now match Hell itself.','Descend into the Endless Depths']];
function showVictory(d=0){const c=G.char,W=WIN_TXT[Math.min(d,WIN_TXT.length-1)];$('winAct').textContent=W[0];$('winSub').innerHTML=W[1];$('winGo').textContent=W[2];
  $('winStats').innerHTML=[['Hero',`${esc(c.name)}, Level ${lvlLabel(c)} ${CLASSES[c.cls].name}`],['Monsters slain',c.kills||0],['Deaths',c.deaths||0],['Gold',c.gold]].map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('winOv').classList.remove('hidden');releaseInputs();setPause();}
tap('winGo',()=>{$('winOv').classList.add('hidden');setPause();toast('The portal is open','Step through to enter the Endless Depths');});
tap('winExit',()=>{$('winOv').classList.add('hidden');setPause();$('quitBtn').click();});
// Rise again: in a zone, inside the same instance (portal.js); on boss arenas and depth levels, the level is rebuilt.
function respawnHero(){$('deathOv').classList.add('hidden');G.char.deaths=(G.char.deaths||0)+1;G.char.gold=Math.floor(G.char.gold*0.9);
  if(G.zone==='map'&&G.char.mapRun){const r=G.char.mapRun;r.lives--;if(r.lives<=0&&!r.done){const town=r.town;endMap('fail');G.p.dead=false;G.p.hp=G.stats.life;startTown(town);return;}toast(`${r.lives} ${r.lives===1?'life':'lives'} left in this map`,'');} // sigils.js
  if(G.zone&&ZONES[G.zone].layout!=='boss')zoneRespawn();else if(G.zone)startZone(G.zone,'respawn');else startDepth(G.depth);}
tap('respawnBtn',respawnHero);
document.addEventListener('visibilitychange',()=>{if(document.hidden){releaseInputs();saveChar();if(G.char&&!G.paused)toggleMenu();}});
function anyPanel(){return ['questOv','invOv','skOv','menuOv','itemOv','deathOv','shopOv','stashOv','smithOv','wayOv','smithAsk','pouchOv','bookOv','actOv','winOv'].some(i=>!$(i).classList.contains('hidden'));}
function setPause(){const panel=anyPanel();G.paused=panel||!G.char;for(let i=0;i<5;i++)held[i]=false;if(panel)G.texts=[];}
let actTimer=0;
function showActTitle(d){const A=ACTS[actIdx(d)],cy=cycleOf(d);
  $('actN').textContent=d>25?'THE ENDLESS DEPTHS':(curDiff()?DIFFS[curDiff()].name.toUpperCase()+' · ':'')+'ACT '+roman(actIdx(d)+1);$('actN').style.color=d<=25&&curDiff()?DIFFS[curDiff()].col:'';$('actT').textContent=A.name;$('actS').textContent=d>25?`Endless ${d-25}: the deep grows stronger`:A.sub;
  const o=$('actOv');o.style.setProperty('--act',A.col);o.classList.remove('hidden');releaseInputs();setPause();clearTimeout(actTimer);actTimer=setTimeout(hideActTitle,3800);}
function hideActTitle(){clearTimeout(actTimer);const o=$('actOv');if(o.classList.contains('hidden'))return;o.classList.add('hidden');setPause();}
function toggleMenu(){if(!G.char)return;$('menuOv').classList.toggle('hidden');if(!$('menuOv').classList.contains('hidden')){renderFilter();renderSettings();$('townBtn').classList.toggle('hidden',!!G.inTown);}setPause();}
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
    `Hiding Tier ${TIER_NAME.slice(0,min-1).join(', ')} ${f.rares!==false?'white and magic items':'items'}${f.min==='auto'?` (auto: you're in Tier ${TIER_NAME[dropAct(PD())-1]} lands)`:''}. Rings, amulets and socketed items always show.`+(hidden?` ${hidden} hidden here.`:'');
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
  const red=Math.round(Math.min(0.75,s.armor/(s.armor+30+10*PD()))*100);
  $('statsum').innerHTML=[['Damage',avg],['Life',Math.round(s.life)],['Armor',`${Math.round(s.armor)} (${red}%)`],['Block',Math.round(s.block)+'%'],['Crit',s.crit.toFixed(1)+'%'],['Crit Dmg','+'+Math.round(s.critd)+'%'],['Attacks/s',(1/skillCd(0)).toFixed(2)],['Atk Speed','+'+Math.round(s.aspd)+'%'],['Cooldown','-'+Math.round(s.cdr)+'%'],['Move','+'+Math.round(s.move)+'%'],['Life on Hit',Math.round(s.loh)],['Regen',s.regen.toFixed(1)+'/s'],['Potions',`${potFloor()} (max ${potMax()})`]].concat(s.spell?[['Spell Dmg','+'+Math.round(s.spell)+'%']]:[],s.gold?[['Gold Found','+'+Math.round(s.gold)+'%']]:[],(s.xp?[['Experience','+'+Math.round(s.xp)+'%']]:[]),[0,1,2,3,4].filter(i=>s['skd'+i]).map(i=>[SKILLS[c.cls][i].name,'+'+Math.round(s['skd'+i])+'%']),(s.bossdmg?[['Boss Damage','+'+Math.round(s.bossdmg)+'%']]:[]),(s.lifepct?[['Max Life','+'+Math.round(s.lifepct)+'%']]:[]),(s.thorns?[['Thorns',Math.round(s.thorns)]]:[]),(s.evade?[['Evade',s.evade.toFixed(1)+'%']]:[]),(s.dr?[['Less Damage',s.dr.toFixed(1)+'%']]:[]),(s.lpk?[['Life per Kill',Math.round(s.lpk)]]:[]),(s.potheal?[['Potion Healing','+'+Math.round(s.potheal)+'%']]:[]),[['Item Rarity','+'+Math.round((s.rarity||0)+lootHere().rar)+'%'+(lootHere().rar?` <span class="fdim">(${DIFFS[diffHere()].name} +${lootHere().rar}%)</span>`:'')]],s.bleed?[['Bleed',Math.round(s.bleed)+'%']]:[],s.stunCh?[['Stun',Math.round(s.stunCh)+'%']]:[],s.oh?[['Dual Wield','+15% rate']]:[],
    // resistances after the difficulty's penalty (red below 0, gold at the 75% cap)
    RES_KEYS.map(k=>{const v=resOf(s,k);return [`<span style="color:${RES_COL[k]}">${RES_NAME[k]} Res</span>`,`<span style="color:${v<0?'#ff6a5a':v>=resCap(s)?'#f2d04a':'inherit'}">${Math.round(v)}%</span>`];}),
    resPenalty()?[['Res penalty',`<span style="color:${DIFFS[curDiff()]?.col||'#ff6a5a'}">−${resPenalty()}%</span>`]]:[]).map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('');
  $('goldv').textContent=c.gold;$('bagCount').textContent=`${c.bag.length}/30`;
  const cells=[];for(let i=0;i<Math.max(30,c.bag.length);i++)cells.push(cellHtml(c.bag[i]));$('bag').innerHTML=cells.join('');
  [...$('bag').children].forEach((el,i)=>el.onclick=()=>{if(c.bag[i])openItem(c.bag[i],false);});
  renderCharms();
}
// Equipment cell; worn set pieces glow in their set's colour while its bonus is on (brighter with the full set).
function setCell(c,sl){const it=c.equip[sl],g=it?setGlow(it,c):'',h=cellHtml(it,SLOT_NAME[sl],sl);if(!g)return h;
  const S=SETS[setOf(it)]; // the glow takes the set's aura colour (CSS variable --sg)
  return h.replace('<div class="cell',`<div title="${esc(S.name)}: ${g==='full'?'full set':'set bonus'} active" class="cell sglow${g==='full'?' full':''}`).replace(' style="',` style="--sg:${S.aura||'63,224,90'};`);}
// v1.0.50: fewer drops, so each salvaged item gives 1.5x the gold (SALV_GOLD); the shop price formula halves its factor to stay the same.
const SALV_GOLD=1.5;
function salvageValue(it){return Math.round((it.ilvl*3+5)*([1,2,5,12,15,12][it.rarity]||1)*SALV_GOLD+upgradeSpent(it)*0.5);} // half of the upgrade gold comes back
// Upgrades are cheaper than before (they no longer touch affixes): x1.45 per level.
// v1.0.51: upgrades cost 30% less (x0.7), so normal play pays for about one weapon and one armor upgrade per zone.
const UPG_PRICE=0.7;
function upgradeCost(it,lv){return Math.round((20+it.ilvl*8)*Math.pow(1.45,lv??(it.upg||0))*UPG_PRICE);}
const upgradeSpent=it=>{let g=0;for(let k=0;k<(it.upg||0);k++)g+=upgradeCost(it,k);return g;};
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
function powerHtml(k,c){const P=UPOW[k],off=P.cls&&P.cls!==c.cls;return `<div class="ipow${off?' off':''}">✦ ${esc(P.t)}${off?` <small>(${CLASSES[P.cls].name} only)</small>`:''}${P.d&&G.stats?`<span class="pdet">${esc(P.d())}</span>`:''}${COMBOS.filter(C=>C.a===k||C.b===k).map(C=>{const on=G.stats&&hasPw(C.a)&&hasPw(C.b);
    return `<span class="pcombo${on?' on':''}">✚ ${esc(C.name)}${on?' (active)':''}, with ${esc(pwSource(C.a===k?C.b:C.a))}: ${esc(C.t)}${C.d&&G.stats?' · '+esc(C.d()):''}</span>`;}).join('')}</div>`;}
// full: the long view with both whole cards (the compact compare is the default for a bag item that would replace one).
function openItem(it,equipped,price,full){
  if(it.slot==='charm'&&price==null)return openCharm(it,equipped==='charm');
  const c=G.char;
  const card=x=>{const mm=upgMul(x);let h=`<div class="card" style="border-color:${RCOL[x.rarity]}"><div class="chead"><div class="cicon">${itemIcon(x)}</div><div><div class="iname" style="color:${RCOL[x.rarity]}">${esc(x.name)}${x.upg?' +'+x.upg:''}</div><div class="isub">${RNAME[x.rarity]} ${typeLabel(x)}${x.tier?' · '+tierLabel(x):''} · Item level ${x.ilvl}${(x.slot==='weapon'||x.slot==='shield'||x.slot==='focus')&&x.cls&&x.cls!==c.cls?` · <span style="color:#e07a5a">${CLASSES[x.cls].name} item</span>`:''}</div></div></div>`;
    if(x.slot==='weapon'){const w=wOf(x);h+=`<div class="ibase">Damage: ${Math.round(x.dmin*mm)}–${Math.round(x.dmax*mm)}</div><div class="ibase">Attack Rate: ${w.spd.toFixed(2)}×</div>`;
      for(const t of weaponProps(w))if(!(w.skill&&t.includes('random skill')))h+=`<div class="ibase">${t}</div>`; // the rolled skill shows below as an implicit
      if(w.arc)h+=`<div class="ibase">Cleave arc: ${w.arc>=1.4?'Very wide':w.arc>=1?'Normal':'Narrow'}</div>`;
      if(w.hands===2)h+=`<div class="ibase" style="color:var(--dim)">Two-handed: blocks the Off Hand</div>`;}
    if(x.arm)h+=`<div class="ibase">Armor: ${Math.round(x.arm*mm)}</div>`;
    for(const a of x.imp||[])h+=`<div class="ibase">${esc(affText(a,mm,x.cls||c.cls))}</div>`;
    if(x.upg)h+=`<div class="itierb">⚒ Upgraded +${x.upg}: +${Math.round(upgStep(x)*100*x.upg)}% ${x.tier?'base stats':'to its stats'}</div>`;
    for(const a of x.affs)h+=`<div class="iaff${a.k==='skill'?' skl':''}">${esc(affText(a,affMul(x),x.cls||c.cls))}${tierTag(a)}</div>`;
    for(const k of itemPowers(x))h+=powerHtml(k,c);
    if(setOf(x))h+=setHtml(x,c);
    if(x.q)h+=`<div class="ibase">Quality +${x.q}%${x.sup?' (and Superior)':''}</div>`;
    if(x.cat&&CURS[x.cat])h+=`<div class="ibase" style="color:${CURS[x.cat].col}">${CURS[x.cat].ic} ${CURS[x.cat].name}: ${esc(CURS[x.cat].desc.replace('Next craft: ',''))} (next craft)</div>`;
    if(craftLimited(x)&&x.slot!=='charm')h+=`<div class="fdim" style="font-size:11px">⚒ ${craftsLeft(x)}/${craftMax(x)} stat crafts left</div>`;
    if(x.sockets){const sk=x.socketed||[],hs=hostOf(x);h+=`<div class="sockrow">${Array.from({length:x.sockets},(_,i)=>sk[i]?`<span class="sock">${stoneSvg(sk[i])}</span>`:'<span class="sock empty"></span>').join('')}<span class="fdim">${sk.length}/${x.sockets} sockets</span></div>`;
      for(const sg of sk)h+=`<div class="isock"><span style="color:${stoneCol(sg)}">${esc(stoneName(sg))}</span>: ${esc(statText(stoneStat(sg,hs)))}</div>`;}
    return h+'</div>';};
  const fits=fitsFor(c,it),target=equipped?null:bestSlot(c,it),multi=fits.length>1;
  const curT=!equipped&&target?c.equip[target]:null,compact=!!curT&&!full&&price==null;
  let h=compact?compareHtml(c,it,curT,target,multi):(curT&&full?'<div class="cvsum" id="cvBack">◂ Compact compare</div>':'')+card(it);
  if(!equipped&&!fits.length)h+=`<div class="cmp dn">${CLASSES[c.cls].name}s can't use this. Salvage or sell it.</div>`;
  else if(!equipped&&!target)h+=`<div class="cmp dn">Your two-handed weapon blocks the Off Hand.</div>`;
  if(!equipped&&target&&!compact){const cur=c.equip[target];
    if(cur)h+=`<div class="isub" style="margin:4px 0">Currently equipped${multi?' ('+SLOT_NAME[target]+')':''}:</div>`+card(cur);
    if(is2h(it)&&c.equip.offhand)h+=`<div class="isub" style="margin:4px 0">Also unequips your Off Hand:</div>`+card(c.equip.offhand);
    const s0=calcStats(c),s1=calcStats(c,it,target);
    const lines=[['Damage',x=>(x.dmin+x.dmax)/2*x.levelMul*(1+x.dmg/100)],['Life',x=>x.life],['Armor',x=>x.armor],['Block %',x=>x.block],['Crit %',x=>x.crit],['Crit Dmg %',x=>x.critd],['Atk Rate %',x=>x.wspd*(1+x.aspd/100)*100],['Spell Dmg %',x=>x.spell],['Bleed %',x=>x.bleed],['Stun %',x=>x.stunCh],['Splash %',x=>x.splash],['Pierce',x=>x.pierce],['Slain explode %',x=>x.explode],['Cooldown %',x=>x.cdr],['Move %',x=>x.move],['Life on Hit',x=>x.loh],['Regen',x=>x.regen],['Max '+CLASSES[c.cls].res,x=>x.res],['Potion Charges',x=>x.pot]];
    let cmp='';for(const [n,f] of lines){const d=f(s1)-f(s0);if(Math.abs(d)>=0.1)cmp+=`<div class="${d>0?'up':'dn'}">${d>0?'▲ +':'▼ '}${Math.abs(d)<10?d.toFixed(1):Math.round(d)} ${n}</div>`;}
    s1.skill.forEach((v,i)=>{const d=v-s0.skill[i];if(d)cmp+=`<div class="${d>0?'up':'dn'}">${d>0?'▲ +':'▼ '}${d} ${SKILLS[c.cls][i].name}</div>`;});
    if(it.tier&&cur&&cur.tier&&it.tier!==cur.tier){const d=it.tier-cur.tier;cmp+=`<div class="${d>0?'up':'dn'}">${d>0?'▲':'▼'} ${tierLabel(it)} vs ${tierLabel(cur)}${cur.upg?' +'+cur.upg:''}: ${d>0?'bigger':'smaller'} stat rolls</div>`;}
    h+=`<div class="cmp"><b>If equipped${multi?' in '+SLOT_NAME[target]:''}:</b>${cmp||'<div>No change</div>'}</div>`;}
  if(price!=null){ // shop listing: buy or close only
    h+=`<div class="row"><div class="btn sm${c.gold<price?' dis':''}" id="iBuy">Buy (${price}🪙)</div><div class="btn sm" id="iClose">Close</div></div>`;
    $('itemPanel').innerHTML=h;$('itemPanel').classList.remove('cvp');$('itemOv').classList.remove('hidden');setPause();
    $('iBuy').onclick=()=>buyItem(it,price);$('iClose').onclick=closeItem;return;}
  const cost=upgradeCost(it);
  const eqOk=sl=>canEquipIn(c,it,sl);
  // already wearing the same unique / Runebind: name it, and say how to choose which one to keep
  const clash=!equipped&&fits.length?pwClash(c,it):null;
  if(clash){const o=c.equip[clash],swap=fits.includes(clash);
    h+=`<div class="ipow" style="color:#e07a5a">⚠ You already wear ${esc(o.name)} (${SLOT_NAME[clash]}). Only one of each ${it.uq?'unique':'Runebind'} can be worn: ${swap?`equip this one in ${SLOT_NAME[clash]} to keep it instead, or close to keep ${esc(o.name)}`:`take off ${esc(o.name)} first to wear this one`}.</div>`;}
  const equipBtns=!fits.length?'':multi?fits.map(sl=>`<div class="btn sm${eqOk(sl)?'':' dis'}" data-eq="${sl}">Equip ${SLOT_NAME[sl]}</div>`).join(''):`<div class="btn sm${eqOk(fits[0])?'':' dis'}" data-eq="${fits[0]}">Equip</div>`;
  h+=`<div class="row">${equipped?'<div class="btn sm" id="iUnequip">Unequip</div>':equipBtns}
    <div class="btn sm${(it.upg||0)>=10||c.gold<cost?' dis':''}" id="iUpg">Upgrade +${(it.upg||0)+1} (${cost}🪙)</div>
    ${freeSockets(it)>0&&it.rarity!==4?`<div class="btn sm" id="iSock">💎 Socket (${freeSockets(it)} free)</div>`:''}
    ${it.socketed&&it.socketed.length&&!it.rb?`<div class="btn sm${G.inTown&&c.gold>=unsocketCost(it)?'':' dis'}" id="iUnsock">Unsocket (${unsocketCost(it)}🪙)</div>`:''}
    ${curAny(it)?'<div class="btn sm" id="iCraft">✦ Craft</div>':''}
    <div class="btn sm" id="iLock">${it.lock?'🔓 Unlock':'🔒 Lock'}</div>
    ${equipped?'':`<div class="btn sm red${it.lock?' dis':''}" id="iSalv">Salvage (+${salvageValue(it)}🪙)</div>`}
    <div class="btn sm" id="iClose">Close</div></div>`;
  $('itemPanel').innerHTML=h;$('itemPanel').classList.toggle('cvp',compact);$('itemOv').classList.remove('hidden');setPause();
  if($('cvFull'))$('cvFull').onclick=()=>openItem(it,equipped,undefined,true);if($('cvBack'))$('cvBack').onclick=()=>openItem(it,equipped);
  const after=()=>{refreshStats();renderInv();saveChar();};
  if($('iCraft'))$('iCraft').onclick=()=>{$('itemOv').classList.add('hidden');openCurrency(it,equipped);}; // currency.js
  if(equipped)$('iUnequip').onclick=()=>{if(c.bag.length>=30){toast('Bag is full');return;}c.equip[equipped]=null;c.bag.push(it);closeItem();after();};
  else{$('itemPanel').querySelectorAll('[data-eq]').forEach(b=>b.onclick=()=>{const sl=b.dataset.eq;if(!eqOk(sl))return;if(equipFromBag(c,it,sl)){closeItem();after();}});
    $('iSalv').onclick=()=>{const r=salvageItem(c,it);if(!r)return;toast('Salvaged',`+${r.gold} gold ${matText(r.mats)}`);closeItem();after();};}
  $('iLock').onclick=()=>{toggleLock(it);renderInv();openItem(it,equipped);};
  if($('iSock'))$('iSock').onclick=()=>{closeItem();openPouch({it,eq:equipped});};
  if($('iUnsock'))$('iUnsock').onclick=()=>{if(!G.inTown){toast('Unsocket in town','The merchant can pry them loose');return;}if(unsocket(it)){after();openItem(it,equipped);}};
  $('iUpg').onclick=()=>{if((it.upg||0)>=10||c.gold<cost)return;c.gold-=cost;it.upg=(it.upg||0)+1;after();openItem(it,equipped);};
  $('iClose').onclick=closeItem;
}
const canEquipIn=(c,it,sl)=>(is2h(it)||slotOpen(c.equip,sl))&&clashFree(c,it,sl);
// Wears a bag item in slot sl; what it replaces (and the off hand, for a two-hander) goes to the bag. False if the bag can't hold them.
function equipFromBag(c,it,sl){const cur=c.equip[sl],drop=sl==='mainhand'&&is2h(it)?c.equip.offhand:null;
  if(c.bag.length-1+(cur?1:0)+(drop?1:0)>30){toast('Bag is full','Make room for your Off Hand item');return false;}
  c.bag.splice(c.bag.indexOf(it),1);if(cur)c.bag.push(cur);if(drop){c.bag.push(drop);c.equip.offhand=null;}c.equip[sl]=it;return true;}
function closeItem(){$('itemOv').classList.add('hidden');setPause();}

// ---------- merchant ----------
function potionPrice(){return 15+PD()*3;} // v1.0.51: was 20+4/depth
function rollShop(d){
  const c=G.char,out=[];
  for(const t of typesFor(c.cls).sort(()=>Math.random()-0.5).slice(0,8)){const it=genItem(d,c.cls,1,t,1);out.push({it,price:Math.round(salvageValue(it)*(3/SALV_GOLD)*rand(0.9,1.1))});}
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
let SETTINGS={joy:'m',lefty:false,sound:true,vib:true,sfxVol:0.8,musVol:0.5};
const vol01=(v,d)=>typeof v==='number'&&v>=0&&v<=1?v:d;
function loadSettings(){try{const o=JSON.parse(localStorage.getItem(SETTINGS_KEY));if(o&&typeof o==='object')SETTINGS={joy:JOY_SIZES[o.joy]?o.joy:'m',lefty:o.lefty===true,sound:o.sound!==false,vib:o.vib!==false,sfxVol:vol01(o.sfxVol,0.8),musVol:vol01(o.musVol,0.5)};}catch(e){}applySettings();}
const SETTINGS_NOW=()=>SETTINGS; // (tests: SETTINGS is a let)
function storeSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(SETTINGS));}catch(e){}backupSoon();}
function setSetting(k,v){SETTINGS[k]=v;storeSettings();releaseInputs();applySettings();renderSettings();}
// Left-handed mode mirrors the controls: joystick on the right, skill arc and dodge on the left.
function applySettings(){document.body.classList.toggle('lefty',SETTINGS.lefty);const R=joyR();$('joy').style.setProperty('--jr',R+'px');
  if(G.char&&skillEls.length)buildSkillBar();placeJoy(null);}
function renderSettings(){
  $('setJoy').innerHTML=[['s','Small'],['m','Medium'],['l','Large']].map(([k,n])=>`<div class="tab${SETTINGS.joy===k?' on':''}" data-j="${k}">${n}</div>`).join('');
  $('setJoy').querySelectorAll('[data-j]').forEach(el=>el.onclick=()=>setSetting('joy',el.dataset.j));
  $('setLefty').classList.toggle('on',SETTINGS.lefty);$('setLefty').onclick=()=>setSetting('lefty',!SETTINGS.lefty);
  $('setSound').classList.toggle('on',SETTINGS.sound!==false);$('setSound').onclick=()=>setSetting('sound',SETTINGS.sound===false);
  $('setVib').classList.toggle('on',SETTINGS.vib!==false);$('setVib').onclick=()=>{setSetting('vib',SETTINGS.vib===false);if(SETTINGS.vib)buzz('heavy');};
  for(const [id,k] of [['setSfxVol','sfxVol'],['setMusVol','musVol']]){const el=$(id);el.value=Math.round((SETTINGS[k]??0.5)*100);
    el.oninput=()=>{SETTINGS[k]=+el.value/100;if(k==='sfxVol')playSfx('gold');}; // live while dragging
    el.onchange=()=>{SETTINGS[k]=+el.value/100;storeSettings();};}}
function showTitle(){
  $('titleOv').classList.remove('hidden');
  $('slots').innerHTML=SAVES.length?SAVES.map((c,i)=>`<div class="slot"><div class="ic">${CLASSES[c.cls].icon}</div><div class="info"><b>${esc(c.name)}</b><div>Level ${lvlLabel(c)} ${CLASSES[c.cls].name} · ${c.diff&&c.depth<=25?DIFFS[c.diff].name+' ':''}${ACTS[actIdx(c.depth)].name} ${depthLabel(c.depth)} (best ${depthLabel(c.endMax||c.maxDepth)})</div></div><div class="btn sm" data-play="${i}">Play</div><div class="btn sm red" data-del="${i}">✕</div></div>`).join(''):'<p class="sub">No heroes yet. Create your first one.</p>';
  $('slots').querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>startGame(SAVES[+b.dataset.play]));
  $('slots').querySelectorAll('[data-del]').forEach(b=>{let armed=false;b.onclick=()=>{if(!armed){armed=true;b.textContent='Delete?';setTimeout(()=>{armed=false;b.textContent='✕';},2500);return;}SAVES.splice(+b.dataset.del,1);storeSaves();showTitle();};});
  $('newBtn').classList.toggle('dis',SAVES.length>=6);
}
function renderClassPick(){$('classPick').innerHTML=Object.entries(CLASSES).map(([k,C])=>`<div class="cls${k===pickCls?' sel':''}" data-c="${k}"><div class="ic">${C.icon}</div><b>${C.name}</b><p>${C.desc}</p></div>`).join('');
  $('classPick').querySelectorAll('.cls').forEach(el=>el.onclick=()=>{pickCls=el.dataset.c;renderClassPick();});}
tap('newBtn',()=>{if(SAVES.length>=6)return;$('titleOv').classList.add('hidden');$('createOv').classList.remove('hidden');$('nameIn').value='';renderClassPick();});
tap('createBack',()=>{$('createOv').classList.add('hidden');showTitle();});
tap('createGo',()=>{const name=$('nameIn').value.trim()||CLASSES[pickCls].name;$('nameIn').blur();const c=newChar(name.slice(0,14),pickCls);SAVES.push(c);storeSaves();startGame(c);});
// ---------- compact item compare (v1.0.64) ----------
// A bag item next to what it would replace: both side by side on one screen, one row per stat (matching stats on the
// same row), tiers small, the difference in green or red, and a summary of what equipping it does to your character
// (DPS, Life, Armor, resistances...). Tapping the summary opens the full view with both whole cards.
const SHORT={life:'Life',res:'Mana/Fury',dmg:'Damage',armor:'Armor',crit:'Crit',critd:'Crit Dmg',aspd:'Atk Speed',cdr:'Cooldown',move:'Move',loh:'Life on Hit',
  regen:'Regen',block:'Block',spell:'Spell Dmg',pot:'Potions',fres:'Fire Res',cres:'Cold Res',lres:'Light Res',pres:'Pois Res',ares:'All Res',rarity:'Rarity',gold:'Gold',
  xp:'XP',lpk:'Life/Kill',bossdmg:'Boss Dmg',lifepct:'Life %',thorns:'Thorns',evade:'Evade',dr:'Less Dmg',potheal:'Pot Heal',maxres:'Max Res',allsk:'All Skills',skill:'Skill'};
const shortName=k=>SHORT[k]||(AFF[k]?AFF[k].t.replace(/[+{}v%]/g,'').trim():k);
const isPct=k=>!!AFF[k]&&/%/.test(AFF[k].t);
const fmtNum=(k,v)=>{const d=AFF[k]&&AFF[k].dec||Math.abs(v)<10&&v%1;return (d?(+v).toFixed(1):Math.round(v))+(isPct(k)?'%':'');};
// Every stat an item gives, merged by key: {key: {v, t, label}} (base damage/armor, quality, implicits, stats, skills, sockets).
function itemRows(it,cls){const R={},add=(key,label,v,t,k)=>{const r=R[key]||(R[key]={v:0,t:null,label,k});r.v+=v;if(t&&(!r.t||t<r.t))r.t=t;};
  const m=upgMul(it)*(1+(it.q||0)/100);
  if(it.slot==='weapon'){add('wdmg','Weapon Dmg',(it.dmin+it.dmax)/2*m,null,null);add('wspd','Attacks/s',wOf(it).spd,null,null);}
  if(it.arm)add('barm','Base Armor',it.arm*m,null,null);
  for(const a of it.imp||[]){if(a.k==='skill')add('sk'+a.s,SKILLS[cls][a.s].name,a.v,null,'skill');else add(a.k,shortName(a.k),a.v*(AFF[a.k].flat?1:upgMul(it)),null,a.k);}
  for(const a of it.affs){if(a.k==='skill')add('sk'+a.s,SKILLS[cls][a.s].name,a.v,null,'skill');else if(AFF[a.k])add(a.k,AFF[a.k].skd!=null?SKILLS[cls][AFF[a.k].skd].name:shortName(a.k),+affVal(a,affMul(it)),a.t,a.k);}
  if(it.socketed){const h=hostOf(it);for(const sg of it.socketed){const st=stoneStat(sg,h);add(st.k,shortName(st.k),st.v,null,st.k);}}
  for(const pw of itemPowers(it))R['pw:'+pw]={label:'★ '+(UPOW[pw]?UPOW[pw].t:pw),v:1,pw:1};
  return R;}
// What equipping changes for the character: DPS (damage x crit x speed x spell), Life, Armor, resistances, the rest.
const dpsOf=s=>(s.dmin+s.dmax)/2*s.levelMul*(1+s.dmg/100)*(1+s.crit/100*s.critd/100)*(1+s.aspd/100)*s.wspd*(1+s.spell/100)*(1+s.skill.reduce((a,b)=>a+b,0)*0.08);
function equipSummary(c,it,slot){const s0=calcStats(c),s1=calcStats(c,it,slot),out=[],d0=dpsOf(s0),d1=dpsOf(s1);
  const pct=d0>0?(d1/d0-1)*100:0;if(Math.abs(pct)>=0.5)out.push([`DPS ${pct>0?'+':''}${pct.toFixed(Math.abs(pct)<10?1:0)}%`,pct]);
  for(const [k,n] of [['life','Life'],['armor','Armor'],['move','Move'],['block','Block']]){const d=s1[k]-s0[k];if(Math.abs(d)>=0.5)out.push([`${n} ${d>0?'+':''}${Math.round(d)}${k==='move'||k==='block'?'%':''}`,d]);}
  for(const k of RES_KEYS){const d=resOf(s1,k)-resOf(s0,k);if(Math.abs(d)>=0.5)out.push([`${RES_NAME[k]} Res ${d>0?'+':''}${Math.round(d)}%`,d]);}
  return out;}
function compareHtml(c,it,cur,slot,multi){const cls=it.cls||c.cls,A=itemRows(it,cls),B=itemRows(cur,cur.cls||c.cls),keys=[...new Set(Object.keys(A).concat(Object.keys(B)))];
  const order=k=>k==='wdmg'?0:k==='wspd'?1:k==='barm'?2:k.startsWith('pw:')?9:k.startsWith('sk')?8:3;keys.sort((a,b)=>order(a)-order(b));
  const sum=equipSummary(c,it,slot);
  const head=x=>`<div class="cvh"><div class="cvn" style="color:${RCOL[x.rarity]}">${esc(x.name)}${x.upg?' +'+x.upg:''}</div><div class="cvs">${x.tier?tierLabel(x)+' · ':''}iLvl ${x.ilvl}${x.q?' · Q'+x.q+'%':''}${x.sockets?' · '+(x.socketed||[]).length+'/'+x.sockets+'◇':''}</div></div>`;
  const cell=(r,k)=>!r?'<span class="cvz">–</span>':r.pw?'<span class="cvpw">✓</span>':`${r.k?fmtNum(r.k,r.v):k==='wspd'?(+r.v).toFixed(2):Math.round(r.v)}${r.t?`<span class="cvt" style="color:${TIER_COL[r.t]}">T${r.t}</span>`:''}`;
  let rows='';for(const k of keys){const a=A[k],b=B[k],lab=(a||b).label;let dt='',cl='';
    if(!(a&&a.pw||b&&b.pw)){const d=(a?a.v:0)-(b?b.v:0);if(Math.abs(d)>=(k==='wspd'?0.005:0.05)){cl=d>0?'up':'dn';const kk=(a||b).k;dt=(d>0?'+':'−')+(kk?fmtNum(kk,Math.abs(d)):k==='wspd'?Math.abs(d).toFixed(2):Math.round(Math.abs(d)));}}
    else cl=a&&!b?'up':b&&!a?'dn':'';
    rows+=`<div class="cvr"><span class="cvl">${esc(lab)}</span><span class="cva ${a&&cl==='up'?'up':''}">${cell(a,k)}</span><span class="cvb ${b&&cl==='dn'?'up':''}">${cell(b,k)}</span><span class="cvd ${cl}">${dt}</span></div>`;}
  const chips=sum.length?sum.map(([t,v])=>`<span class="${v>0?'up':'dn'}">${t}</span>`).join(' · '):'<span class="fdim">No change</span>';
  return `<div class="cvsum" id="cvFull" title="Tap for the full view"><b>If equipped${multi?' ('+SLOT_NAME[slot]+')':''}:</b> ${chips} <span class="fdim">▸ details</span></div>
    <div class="cvgrid"><div class="cvr cvtop"><span class="cvl"></span><span class="cva">${head(it)}</span><span class="cvb">${head(cur)}</span><span class="cvd"></span></div>
    <div class="cvr cvlab"><span class="cvl"></span><span class="cva">New</span><span class="cvb">Equipped</span><span class="cvd">Δ</span></div>${rows}</div>`;}
