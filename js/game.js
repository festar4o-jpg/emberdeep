'use strict';
// Combat, effects, starting characters/depths/town, and the per-frame update.
// ---------- combat ----------
function rollDmg(mult,hand){const s=G.stats;const h=hand==='oh'&&s.oh?s.oh:hand==='mh'&&s.mh?s.mh:null;let d=(h?rand(h.dmin,h.dmax):rand(s.dmin,s.dmax))*s.levelMul*(1+s.dmg/100)*(1+s.spell/100)*mult;if(G.p.buffT>0)d*=1+G.p.buffAmt;if(hasPw('bloodrage')&&(G.p.hp<s.life*0.5||G.p.rageT>0))d*=1.25;if(G.p.wrathT>0)d*=1.3;if(G.p.pyreT>0&&G.p.pyreN)d*=1+0.03*G.p.pyreN;if(G.sk!=null){const v=s['skd'+G.sk];if(v)d*=1+v/100;}if(G.p.souls&&hasPw('soulHarvest'))d*=1+0.02*G.p.souls; /* +% damage with this skill (G.sk: the skill this hit comes from) */const crit=Math.random()*100<s.crit||G.sk===2&&hasPw('whirlCrit');if(crit)d*=1+s.critd/100;return {d:Math.max(1,Math.round(d)),crit};}
function hitEnemy(e,mult,opts={}){
  if(e.dead||e.hidden||e.spawnT>0||e.introT>0)return;
  if(e.transT>0){if(!opts.quiet&&G.time-(e.immT||-9)>0.4){e.immT=G.time;floatText(e.x,e.y-e.r-6,'Immune',ACTS[e.kind||0].col,false);}return;} /* a boss between phases */
  if(e.shieldT>0){aggroPack(e);if(!opts.quiet&&G.time-(e.immT||-9)>0.4){e.immT=G.time;floatText(e.x,e.y-e.r-6,'Immune','#9ab0ff',false);}return;} // Shielded elite's bubble
  const r=rollDmg(mult,opts.hand);if(G.stats.bossdmg&&(e.type==='boss'||e.zb))r.d*=1+G.stats.bossdmg/100;if(e.brokenUntil>G.time)r.d*=1.25; /* Quakeplate */if(G.sk===0&&e.hp<e.maxHp*0.3&&hasMod('execute'))r.d*=1.5; /* skillmods.js: Executioner */r.d*=shockMul(e); /* ailments.js: Shock */ /* +% damage to bosses */if(e.dr)r.d=Math.max(1,Math.round(r.d*(1-e.dr)));r.d=dmgTo(e,r.d,r.crit,opts);e.hp-=r.d;bossGate(e); /* bossfight.js: level rule, boss multipliers, hit cap, stagger, phase gates */
  hitFeel(e,r.d,r.crit,opts); // fx.js: flash, spray, sparks, splat, hit-stop
  if(hasAff(e,'reflect')&&!opts.splashed)reflectHit(e,r.d);if(e.type==='thief')thiefHit(e);e.flash=0.1;e.lastHit=G.time;aggroPack(e);
  const st=G.stats;
  if(G.sk===4&&hasPw('shatterArmor'))e.brokenUntil=G.time+5;
  if(G.sk===0&&hasPw('cleaveBleed')&&!opts.dot&&!opts.splashed){const dps=r.d*0.8/3;e.bleedDps=e.bleedT>0?Math.max(e.bleedDps,dps):dps;e.bleedT=3;}
  if(G.sk===0&&hasPw('boltChain')&&!opts.chained&&!opts.splashed&&!opts.dot){const o=nearest(e.x,e.y,220,new Set([e]));if(o){G.fx.push({type:'bolt',pts:[{x:e.x,y:e.y},{x:o.x,y:o.y}],t:0,max:0.18});hitEnemy(o,mult*0.6,{chained:true});}}
  if(st.bleed>0&&!opts.dot&&Math.random()*100<st.bleed){const dps=r.d*0.8/3;e.bleedDps=e.bleedT>0?Math.max(e.bleedDps,dps):dps;e.bleedT=3;}
  if(st.stunCh>0&&!opts.dot&&!(e.stunCd>0)&&Math.random()*100<st.stunCh){e.stun=Math.max(e.stun,e.type==='boss'?st.stunDur*0.3:st.stunDur);e.stunCd=1.5;floatText(e.x,e.y-e.r-20,'Stun','#ffd54a',false);}
  if(!opts.quiet)floatText(e.x+rand(-8,8),e.y-e.r-6,r.d,r.crit?'#ffd54a':'#fff',r.crit);
  else if(opts.dot)floatText(e.x+rand(-10,10),e.y-e.r-4,r.d,'#ff9a4a',false); // burning: small orange numbers
  if(G.stats.loh&&!opts.splashed)healPlayer(G.stats.loh,true);
  if(r.crit&&!opts.splashed&&hasPw('veilCrit'))healPlayer(G.stats.life*0.01,true);
  if(r.crit&&!opts.splashed&&!opts.dot&&hasPw('stormbeat'))stormbeat();
  if(opts.ignite||(hasPw('ignite')&&!opts.splashed&&!opts.dot))ignite(e);
  if(opts.stun&&e.type!=='boss')e.stun=Math.max(e.stun,opts.stun);
  if(opts.stun&&e.type==='boss')e.stun=Math.max(e.stun,opts.stun*0.3);
  if(opts.freeze)e.frozen=Math.max(e.frozen,e.type==='boss'?opts.freeze*0.35:opts.freeze);
  applyAilments(e,r.d,opts); // ailments.js: Ignite, Shock, Chill, Poison
  if(opts.kb&&!ETYPES[e.type].heavy){const a=Math.atan2(e.y-G.p.y,e.x-G.p.x);moveEnt(e,Math.cos(a)*opts.kb*0.3,Math.sin(a)*opts.kb*0.3);}
  if(!opts.quiet)for(let k=0;k<3;k++)G.parts.push({x:e.x,y:e.y,vx:rand(-90,90),vy:rand(-90,90),life:0.3,max:0.3,col:'#8a1a1a',s:3});
  // flail / thornstaff: weapon hits splash onto enemies around the target
  if(opts.weapon&&st.splash>0){let any=false;for(const o of G.enemies){if(o===e||o.dead||o.hidden||o.spawnT>0)continue;if(Math.hypot(o.x-e.x,o.y-e.y)<SPLASH_R+o.r){hitEnemy(o,mult*st.splash/100,{hand:opts.hand,splashed:true});any=true;}}
    if(any)G.fx.push({type:'ring',x:e.x,y:e.y,r0:6,r1:SPLASH_R,t:0,max:0.2,col:'#e8d0a0'});}
  if(hasPw('ashChain')&&!opts.splashed&&!opts.dot&&!opts.chained&&Math.random()<ASH_CH)ashChain(e);
  if(e.hp<=0){killEnemy(e);if(st.explode>0&&!G.blasting)demonBlast(e);}
}
const SPLASH_R=70;
// Demonic weapons: a slain enemy bursts, hitting everything nearby (a burst never sets off another burst).
function demonBlast(e){G.blasting=true;try{aoe(e.x,e.y,80,G.stats.explode/100,{splashed:true});}finally{G.blasting=false;}
  burst(e.x,e.y,16,'#ff3a2a',200);G.fx.push({type:'ring',x:e.x,y:e.y,r0:8,r1:85,t:0,max:0.25,col:'#ff4a2a'});}
function aggroPack(e){if(e.aggro)return;for(const o of G.enemies)if(o.pack===e.pack)o.aggro=true;e.aggro=true;}
function killEnemy(e){
  e.dead=true;if(e.type!=='boss')playSfx(['bone','ice','chitin'].includes(matOf(e))?'shatter':'kill');stainFloor(e);addCorpse(e);/* fx.js: a stain painted into the map */G.char.kills=(G.char.kills||0)+1;burst(e.x,e.y,e.type==='boss'?60:14,e.type==='boss'?'#ff5a3a':'#5a1a1a',e.type==='boss'?320:160);
  const T0=ETYPES[e.type];
  if(T0.cloud)addEHaz(e.x,e.y,70,4,e.dmg*0.55,'poison'); // spore toads burst into a poison cloud
  affixDeath(e);
  if(hasPw('bloodrage'))healPlayer(G.stats.life*0.02,true);
  if(G.stats.lpk)healPlayer(G.stats.lpk,true); // charms: Life per Kill
  if(hasPw('soulHarvest')){G.p.souls=Math.min(10,(G.p.souls||0)+1);G.p.soulT=4;}
  if(e.frozen>0&&hasPw('shatter'))iceShards(e);
  if(T0.split&&(e.gen||0)<2)for(let k=0;k<2;k++){const a=rand(0,TAU);let x=e.x+Math.cos(a)*e.r*0.6,y=e.y+Math.sin(a)*e.r*0.6;if(blockedAt(x,y,10)){x=e.x;y=e.y;}
    const c=makeEnemy(e.type,x,y,G.depth,e.elite,e.pack,e.affs);c.chest=e.chest;c.gen=(e.gen||0)+1;c.r=Math.max(9,e.r*0.72);c.hp=c.maxHp=e.maxHp*0.45;c.dmg=e.dmg*0.7;c.xp=e.xp*0.35;c.spd=e.spd*1.1;
    c.aggro=true;c.spawnT=0.25;c.noLoot=true;c.name=e.name;G.enemies.push(c);burst(x,y,8,'#dff4ff',140);}
  gainXp(Math.round(e.xp*(e.summoned?0.3:1)));
  if(!e.summoned){trophyKill(e);G.char.namedSince=(G.char.namedSince||0)+1;} // kills since the last set/unique (items.js NAMED_PITY)
  if(e.noLoot||e.summoned)return;
  if(e.type==='thief'){thiefLoot(e);return;}
  const dk=e.type==='boss'?'boss':e.elite?'elite':'normal';dropStones(e,dk);dropCharms(e,dk);{const kd=e.type==='boss'?'boss':e.zb?'zboss':e.su?'su':dk;dropCurrency(e,kd);sigilDrops(e,kd);} // gems, runes, charms, currency, Sigils (sigils.js)
  const T=ETYPES[e.type];const c=G.char; // Item Rarity (G.stats.rarity) changes what drops, not how often: see rollDrop
  if(Math.random()<GOLD_CH||e.elite)dropGold(e.x,e.y,Math.round(randi(2,6)*PD()*(e.elite?3:1)));
  if(e.type==='boss'&&e.ab)archDown(e); // pinnacle.js: a Citadel guardian or the Hollow Sun
  else if(e.type==='boss'){const L=bossDef(e).loot,n=L.n+Math.max(PD()>25?1:0,lootHere().boss);
    for(let k=0;k<n;k++){const min=k<L.unique?3:k<L.unique+L.rare?2:1;dropItem(e.x+rand(-50,50),e.y+rand(-50,50),rollDrop(c,PD()+L.ilvl,3,min,{act:dropAct(PD()),top:true}));}
    dropGold(e.x,e.y,PD()*L.gold);dropGold(e.x+20,e.y,PD()*L.gold*0.5);
    if(actIdx(G.depth)===4)emberCoreDrop(e);
    if(G.depth<=25)questDone(`a${actIdx(G.depth)+1}q4`); /* zones.js: each act's last quest */
    G.portal.active=true;G.p.potions=Math.max(potFloor(),G.p.potions);G.shake=20;
    if(G.depth===25&&(c.diffDone||0)<=(c.diff||0)){const d=c.diff||0;c.diffDone=d+1;c.won=true;toast(e.name+' falls!',c.diffDone>=3?'Maps are open: the Map Device is at every Waystone':'');if(c.diffDone>=3&&!c.sigGift){c.sigGift=1;for(let i=0;i<3;i++)sigAdd(genSigil(1,0));}setTimeout(()=>{if(G.char===c&&G.p&&!G.p.dead)showVictory(d);},1800);} // maps.js: the next difficulty opens
    else if(G.depth%25===0)toast(e.name+' falls!','The deep grows stronger still');
    else toast('Boss defeated!',`${ACTS[actIdx(G.depth+1)].name} awaits beyond the portal`);bossTrophy(e);dropUCharm(e);saveChar();} // after the boss toast, so a trophy's toast shows
  else if(e.type==='zboss')zoneBossDown(e); /* zones.js */
  else if(e.su)superDown(e);
  else if(e.elite){if(Math.random()<Math.min(1,(ELITE_DROP+(e.affs.length>=3?0.03:0))*lootHere().drop))dropItem(e.x+rand(-20,20),e.y+rand(-20,20),rollDrop(c,PD()+1,1,0,{act:dropAct(PD())}));}
  else if(Math.random()<normalDrop(T)*lootHere().drop)dropItem(e.x,e.y,rollDrop(c,PD(),0,0,{act:dropAct(PD())}));
}
// Item drop chances (v1.0.77): normal monsters about 1.9-2.9% (tougher kinds more), champion/magic pack members 10%
// (13% with 3+ affixes). Super uniques, zone bosses and act bosses drop fixed amounts (zones.js superDown/zoneBossDown,
// BOSSES[].loot). Gold is separate and more common; gems, runes and charms keep their own rates.
// Nightmare and Hell: x1.1 / x1.2 item chances, more Item Rarity, gold, gems and boss items (maps.js DIFFS loot).
const ELITE_DROP=0.1,GOLD_CH=0.5; // v1.0.77: half of v1.0.74 again (a quarter of the old rate; rarity bonuses unchanged)
const normalDrop=T=>0.015+(T.drop||0)*0.0625;
function dropItem(x,y,it){if(it&&(it.rarity===3||it.rarity===5)&&G.char&&!namedFound(it))G.char.namedSince=0; /* only one you haven't found resets the guarantee (sockets.js BOOK) */if(blockedAt(x,y,4)){x=G.p.x;y=G.p.y;}const l={x,y,item:it,t:0};G.loot.push(l);if(!lootHidden(it)){dropSfx(l);dropFlash(l);}} // sfx.js: a chime for rare and better
function dropGold(x,y,v){v=Math.round(v*lootHere().gold);G.loot.push({x:x+rand(-14,14),y:y+rand(-14,14),gold:v,t:0});} // maps.js: more gold in Nightmare and Hell
// Returns true when the hit landed (not blocked). src = the attacking enemy, for elite effects.
// Movement input from the joystick and WASD/arrows, length at most 1.
function moveInput(){let mx=0,my=0;if(joy.active){mx=joy.dx;my=joy.dy;}
  if(keys.KeyW||keys.ArrowUp)my-=1;if(keys.KeyS||keys.ArrowDown)my+=1;if(keys.KeyA||keys.ArrowLeft)mx-=1;if(keys.KeyD||keys.ArrowRight)mx+=1;
  const ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;}return [mx,my];}
// Dodge: a quick dash (about 140px) in the move direction (or facing), untouchable while it lasts.
const DODGE_CD=1.4,DODGE_DUR=0.26,DODGE_SPD=540;
function tryDodge(){const p=G.p;if(G.paused||!p||p.dead||playerFrozen()||p.leap||p.dodge||p.spin>0||p.dodgeCd>0||(G.char&&portraitBlocked()))return false;
  const [mx,my]=moveInput(),a=Math.hypot(mx,my)>0.2?Math.atan2(my,mx):p.face;p.dodgeCd=DODGE_CD;playSfx(G.char&&G.char.cls==='arcanist'?'blink':'dodge');
  if(G.char&&G.char.cls==='arcanist'){ /* the Arcanist's dodge is a Blink: an instant hop along open floor, untouchable for a moment */
    const x0=p.x,y0=p.y;for(let d=8;d<=BLINK_DIST;d+=8){const x=x0+Math.cos(a)*d,y=y0+Math.sin(a)*d;if(blockedAt(x,y,p.r))break;p.x=x;p.y=y;}
    p.dodge={t:0,dur:0.14,a,blink:true};p.face=a;burst(x0,y0,14,'#c48bff',160);burst(p.x,p.y,14,'#c48bff',160);G.fx.push({type:'ring',x:p.x,y:p.y,r0:6,r1:40,t:0,max:0.2,col:'#c48bff'});return true;}
  p.dodge={t:0,dur:DODGE_DUR,a};burst(p.x,p.y+p.r*0.5,10,'#c8b090',120);return true;}
const BLINK_DIST=175;
// el: the hit's element (a resistance key) when not the attacker's own (src.elem, src.elemS share of the hit).
function dmgPlayer(raw,src,el){
  const p=G.p;if(p.dead||p.leap||p.dodge)return false;raw*=underMul()*bossTakenMul();
  if(G.stats.evade>0&&Math.random()*100<G.stats.evade){floatText(p.x,p.y-p.r-8,'Evade','#a8e0c0',false);return false;} // v1.0.70: evasion
  raw*=1-(G.stats.dr||0)/100; // less damage taken /* bossfight.js: underleveled for the area, boss matchup */
  raw*=modTakenMul()*playerShockMul(); // skillmods.js: Iron Landing, Ice Armour; ailments.js: Shocked
  const blk=G.stats.block+(p.spin>0&&hasMod('bladeward')?25:0);
  if(blk>0&&Math.random()*100<blk){floatText(p.x,p.y-p.r-8,'Block','#cfd6dc',false);playSfx('block');if(hasPw('kingsWrath'))p.wrathT=3;if(hasPw('counter'))counterBlast();return false;}
  const red=Math.min(0.75,G.stats.armor/(G.stats.armor+30+10*PD()));
  const E=el||src&&src.elem,sh=el?1:src&&src.elemS||1,rm=E?1-sh*resOf(G.stats,E)/100:1; // items.js: resistances (penalty included)
  let d=Math.max(1,Math.round(raw*(1-red)*rm*rand(0.9,1.1)));
  if(p.barrier>0){const a=Math.min(p.barrier,d);p.barrier-=a;d-=a;if(!d){floatText(p.x,p.y-p.r-8,'Absorbed','#ffd27a',false);return true;}} // Warlord's Visage
  if(hasPw('manaShield')&&p.res>0){const m=Math.min(p.res,Math.floor(d*0.25));p.res-=m;d-=m;} // Mantle of Sorrows
  if(hasPw('thornBurst')&&G.time-(p.tbT||-9)>=1){p.tbT=G.time;aoe(p.x,p.y,110,0.6,{});G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:115,t:0,max:0.3,col:'#8ac060'});}
  p.hp-=d;p.hurt=0.15;playSfx('hurt');if(E)playerAilHit(E,sh,d); /* ailments.js: burning, chill/freeze, shock, poison on you */if(p.tpCast)portalInterrupt(); /* portal.js: a hit breaks the cast */
  floatText(p.x,p.y-p.r-8,d,E&&sh>=0.5?RES_COL[E]:'#ff5a5a',false);
  {const L=G.stats.life,big=src&&(src.type==='boss'||src.zb);if(d>=L*0.2||(big&&d>=L*0.08))buzz('heavy');else if(d>=L*0.08)buzz('hurt');} // vibration (sfx.js)
  if(src&&!src.dead&&hasAff(src,'vampiric')){src.hp=Math.min(src.maxHp,src.hp+d*2);floatText(src.x,src.y-src.r-8,'+'+Math.round(d*2),'#e04060',false);}
  if(G.stats.thorns&&src&&!src.dead&&src.hp!=null&&src.type!=='nest'){const t=Math.round(G.stats.thorns*(src.type==='boss'?0.5:1));src.hp-=t;src.flash=0.06;if(src.type==='boss')bossGate(src);if(src.hp<=0&&!src.dead)killEnemy(src);} // thorns
  if(hasPw('frostward'))autoNova();if(hasPw('rimeSkin'))rimeSkin(src);if(hasPw('lastBreath'))lastBreath();
  checkDeath(p);return true;
}
function checkDeath(p){if(p.hp<=0&&!p.dead){p.hp=0;p.dead=true;playSfx('death');setTimeout(()=>{if(G.p!==p||!p.dead)return;G.paused=true;$('deathOv').classList.remove('hidden');},600);}}
// Lava ignores armor and block.
function burnPlayer(v,col){const p=G.p;if(p.dead)return;const d=Math.max(1,Math.round(v));p.hp-=d;p.hurt=Math.max(p.hurt,0.12);floatText(p.x+rand(-6,6),p.y-p.r-8,d,col||'#ff9a3a',false);checkDeath(p);}
function slowPlayer(amt,t){const p=G.p;p.slowAmt=Math.max(p.slowT>0?p.slowAmt:0,amt);p.slowT=Math.max(p.slowT||0,t);}
// Enemy ground hazards (poison clouds, fire patches) damage the player over time.
// A hazard's damage taken through its element's resistance.
const HAZ_RES={fire:'fres',frost:'cres',poison:'pres'},resMul=k=>k?1-resOf(G.stats,k)/100:1;
function addEHaz(x,y,r,t,dps,kind){if(G.ehaz.length>70)G.ehaz.shift();G.ehaz.push({x,y,r,t,max:t,dps,kind});}
function healPlayer(v,silent){const p=G.p;if(p.dead)return;const before=p.hp;p.hp=Math.min(G.stats.life,p.hp+v);if(!silent&&p.hp-before>=1)floatText(p.x,p.y-p.r-20,'+'+Math.round(p.hp-before),'#5f5',false);}
function shoot(a,spd,r,col,o){const p=G.p;const ang=Math.atan2(a.y-p.y,a.x-p.x);p.face=ang;G.proj.push({sk:G.sk,x:p.x+Math.cos(ang)*18,y:p.y+Math.sin(ang)*18,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,r,col,life:1.4,from:'p',mult:o.mult,explode:o.explode,onhit:o.onhit,weapon:o.weapon,pierce:o.pierce||0,home:o.home});}
function enemyShoot(e,ang,spd,col,dmg,r,extra){G.proj.push(Object.assign({x:e.x,y:e.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,r:r||5,col,life:2.5,from:'e',dmg,src:e},extra));}
function eShoot(e,ang){e._lunge=G.time; // sprites.js: recoil as the shot leaves
const S=ETYPES[e.type].shot,n=S.n||1,sl=S.slow||0;for(let k=0;k<n;k++)enemyShoot(e,ang+(k-(n-1)/2)*0.16+rand(-0.05,0.05),S.spd,S.col,e.dmg*(n>1?0.75:1),S.r,sl?{slow:sl}:null);}
function explodeAt(x,y,rad,mult){fxExplosion(x,y,rad);aoe(x,y,rad,mult,{});burst(x,y,22,'#ff8a2a',220);G.fx.push({type:'ring',x,y,r0:8,r1:rad,t:0,max:0.25,col:'#ffaa44'});G.shake=Math.max(G.shake,4);}

function gainXp(v){
  const c=G.char;v*=1+(G.stats&&G.stats.xp||0)/100; /* charms: Experience */if(c.lvl>=MAX_LVL)return gainParagon(Math.round(shrineXp(v)));c.xp+=Math.round(shrineXp(v));
  while(c.lvl<MAX_LVL&&c.xp>=xpNeed(c.lvl)){c.xp-=xpNeed(c.lvl);c.lvl++;c.skillPts++;buzz('levelup');playSfx('levelup');refreshStats();G.p.hp=G.stats.life;G.p.res=G.stats.res;
    const newSk=SKILL_REQ.indexOf(c.lvl);toast('Level '+c.lvl+'!',newSk>0?'New skill available — tap ✨':'+1 skill point');
    G.fx.push({type:'ring',x:G.p.x,y:G.p.y,r0:10,r1:120,t:0,max:0.6,col:'#ffd54a'});burst(G.p.x,G.p.y,30,'#ffd54a',200);buildSkillBar();saveChar();}
}
// After level 50 every bit of XP fills Paragon levels instead (leftover XP at 50 carries over).
function gainParagon(v){const c=G.char;c.para=c.para||0;c.pxp=(c.pxp||0)+v+(c.xp||0);c.xp=0;let up=false;
  while(c.pxp>=paraNeed(c.para)){c.pxp-=paraNeed(c.para);c.para++;up=true;}
  if(up){refreshStats();toast('Paragon '+c.para+'!',`+${PARA_DMG}% damage, +${PARA_LIFE} Life (total +${c.para*PARA_DMG}% / +${c.para*PARA_LIFE})`);
    G.fx.push({type:'ring',x:G.p.x,y:G.p.y,r0:10,r1:120,t:0,max:0.6,col:'#7fe4f4'});burst(G.p.x,G.p.y,30,'#7fe4f4',200);saveChar();}}
const lvlLabel=c=>c.para?`${c.lvl} ✦${c.para}`:String(c.lvl);
function refreshStats(){G.stats=calcStats(G.char);if(G.p){G.p.hp=Math.min(G.p.hp,G.stats.life);G.p.res=Math.min(G.p.res,G.stats.res);}}

// ---------- fx helpers ----------
function burst(x,y,n,col,sp){for(let k=0;k<n;k++){if(G.parts.length>350)break;const a=rand(0,TAU),v=rand(sp*0.3,sp);G.parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(0.3,0.7),max:0.7,col,s:rand(2,4)});}}
function floatText(x,y,txt,col,big){if(G.texts.length>60)G.texts.shift();G.texts.push({x,y,txt:String(txt),col,big,t:0});}
let toastTimer=0;
function toast(a,b){const t=$('toast');t.innerHTML=esc(a)+(b?'<small>'+esc(b)+'</small>':'');t.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.style.opacity=0,2200);}

// ---------- start / depth ----------
function newChar(name,cls){
  const c={id:'c'+Date.now(),name,cls,lvl:1,xp:0,gold:0,depth:1,maxDepth:1,skills:[1,0,0,0,0],mods:[null,null,null,null,null],skillPts:0,equip:Object.fromEntries(EQ_SLOTS.map(s=>[s,null])),bag:[],ver:SAVE_VER,actSeen:0,diff:0,diffDone:0,dsave:{}};
  const w=genItem(1,cls,0,'weapon',0,cls==='warden'?'sword':'wand');w.rarity=0;w.affs=[];delete w.uq;w.name=w.base;c.equip.mainhand=w;
  if(cls==='arcanist'){const o=genItem(1,cls,0,'focus');o.rarity=0;o.affs=[];delete o.uq;o.kind='orb';o.base=o.name='Orb';o.imp=[{k:'spell',v:10}];c.equip.offhand=o;}
  return c;
}
function startGame(c){
  migrateZones(c);G.char=c;G.stats=calcStats(c);noteSetPieces(EQ_SLOTS.map(s=>c.equip[s]).concat(c.bag));
  G.p={x:0,y:0,r:15,hp:G.stats.life,res:CLASSES[c.cls].res==='Fury'?20:G.stats.res,face:0,cd:[0,0,0,0,0],cdMax:[1,1,1,1,1],potions:c.potions??3+G.stats.pot,potCd:0,buffT:0,buffAmt:0,spin:0,leap:null,hurt:0,dead:false};
  $('mpb').classList.toggle('fury',CLASSES[c.cls].res==='Fury');
  $('dodgeBtn').firstChild.nodeValue=c.cls==='arcanist'?'💫':'💨'; /* Arcanists Blink, Wardens roll */
  buildSkillBar();
  ['titleOv','createOv'].forEach(i=>$(i).classList.add('hidden'));$('hud').classList.remove('hidden');
  if(c.mapRun&&c.mapRun.sig&&ZONES[c.mapRun.src])regMapZone(c.mapRun);else c.mapRun=null; // sigils.js: the open map, before its kept instance loads
  if(mapsOpen(c)&&!c.sigGift){c.sigGift=1;for(let i=0;i<3;i++)SIGILS.length<SIG_CAP&&SIGILS.push(genSigil(1,0));storeSigils();} // first maps: three Tier 1 Sigils
  instLoad(c); /* portal.js: this hero's kept zones */
  if(c.town)startTown(c.depth);else if(c.zone==='map'&&c.mapRun)startZone('map','resume');else startDepth(c.depth); // an open map: back into it
}
// mode (boss depths, from the Waystone): 'all' (default), 'boss' = the boss alone, 'noboss' = the packs only.
function startDepth(d,mode){
  if(zoneOfDepth(d))return startZone(zoneOfDepth(d),mode); /* zones.js / acts.js: acts built of zones */
  G.zone=null;G.sidePortal=null;G.zboss=null;
  const c=G.char;if(c.mapRun)endMap('abandon'); /* sigils.js */G.depth=d;c.depth=d;c.town=0;if(d>25)c.endMax=Math.max(c.endMax||0,d);else c.maxDepth=Math.max(c.maxDepth,d); // endless reach: one for all difficulties
  resetArea();G.inTown=false;G.merchant=null;G.stash=null;G.smith=null;G.bench=null;G.waystone=null;G.levelMode=d%5===0&&mode?mode:'all';
  const p=G.p;p.potions=Math.max(p.potions,potFloor());
  genLevel(d,G.levelMode);G.cam.x=p.x;G.cam.y=p.y;
  $('descBtn').textContent='⬇ Descend';
  const newAct=stageOf(d)===1&&(c.actSeen||0)<d;if(newAct)c.actSeen=d;
  saveChar();setPause();
  if(newAct)showActTitle(d);else toast(d>25?`Endless ${d-25} · ${ACTS[actIdx(d)].name}`:`${ACTS[actIdx(d)].name} ${stageOf(d)}/5`,d%5===0?(G.levelMode==='noboss'?'The boss is away; its halls are not empty':G.levelMode==='boss'?'The boss awaits, alone':'A powerful foe awaits…'):'');
}
function resetArea(){
  G.areaT=G.time;G.bossIntro=null;G.zoneTheme=null;G.elder=null; // a new area: no boss banner left over from the last one
  G.proj=[];G.fx=[];G.parts=[];G.texts=[];G.loot=[];G.hazards=[];G.ehaz=[];G.delayed=[];G.feats=[];G.walls=[];G.nearFeat=null;G.town=null;G.tpField=null;G.tpBack=null;G.atTp=false;
  const p=G.p;clearPlayerAils(p);p.dead=false;p.tpCast=null;p.leap=null;p.dodge=null;p.dodgeCd=0;p.spin=0;p.hp=G.stats.life;p.cd=[0,0,0,0,0];
  $('shopBtn').classList.add('hidden');$('stashBtn').classList.add('hidden');$('smithBtn').classList.add('hidden');$('benchBtn').classList.add('hidden');$('wayBtn').classList.add('hidden');$('descBtn').classList.add('hidden');$('useBtn').classList.add('hidden');useLabel='';
}
// Town sits between depths: safe, no enemies, merchant + portal to `next`.
function startTown(next){
  G.zone=null;G.sidePortal=null;G.zboss=null;
  const c=G.char;G.depth=next;c.depth=next;c.town=1; // quitting in town resumes in town (portal.js: a kept zone waits behind the return portal)
  resetArea();G.inTown=true;
  genTown();placeElder();placeTpBack();G.cam.x=G.p.x;G.cam.y=G.p.y;
  G.shop=rollShop(next);
  saveChar();setPause();
  const T=townOf(next);toast(T.name,T.sub);
}

// ---------- update ----------
const joy={active:false,id:null,ox:0,oy:0,dx:0,dy:0};
function update(dt){
  const p=G.p,s=G.stats,C=CLASSES[G.char.cls];G.time+=dt;
  // timers
  for(let i=0;i<5;i++)if(p.cd[i]>0)p.cd[i]-=dt;
  p.potCd-=dt;p.hurt-=dt;if(p.buffT>0)p.buffT-=dt;modTick(p,dt);playerAilTick(p,dt); /* skillmods.js, ailments.js */if(p.barrierT>0){p.barrierT-=dt;if(p.barrierT<=0)p.barrier=0;}if(p.souls>0){p.soulT-=dt;if(p.soulT<=0){p.souls--;p.soulT=1;}}G.bagFullT-=dt;
  if(p.atk){p.atk.t+=dt;if(p.atk.t>=p.atk.dur)p.atk=null;}
  if(p.slowT>0){p.slowT-=dt;if(p.slowT<=0)p.slowAmt=0;}
  if(!p.dead){p.hp=Math.min(s.life,p.hp+s.regen*dt);p.res=Math.min(s.res,p.res+C.regen*dt);}
  heartTick(dt,p.dead?0:p.hp,s.life); // sfx.js: heartbeat at low life
  // movement
  const [mx,my]=moveInput(),ml=Math.hypot(mx,my);if(p.dodgeCd>0)p.dodgeCd-=dt;
  if(p.dead){}
  else if(playerFrozen()){} // ailments.js: frozen in place
  else if(p.dodge){const D=p.dodge;D.t+=dt;if(!D.blink)moveEnt(p,Math.cos(D.a)*DODGE_SPD*dt,Math.sin(D.a)*DODGE_SPD*dt);p.face=D.a;
    if(!D.blink&&Math.random()<0.6)G.parts.push({x:p.x+rand(-8,8),y:p.y+p.r*0.6,vx:-Math.cos(D.a)*60,vy:-20,life:0.35,max:0.35,col:'#c8b090',s:3});
    if(D.t>=D.dur){p.dodge=null;if(hasPw('cometDash')&&!G.inTown)cometImpact();}}
  else if(p.leap){const L=p.leap;L.t+=dt;const t=Math.min(1,L.t/L.dur);p.x=L.sx+(L.tx-L.sx)*t;p.y=L.sy+(L.ty-L.sy)*t;
    if(t>=1){p.leap=null;G.sk=L.sk??null;aoe(p.x,p.y,95,L.mult,{stun:1});if(hasPw('leapFire'))G.hazards.push({sk:G.sk,x:p.x,y:p.y,r:85,t:3,tick:0,mult:0.35});G.sk=null;G.shake=10;G.hitStop=0.06;fxCracks(p.x,p.y,100);burst(p.x,p.y,28,'#c8a070',220);G.fx.push({type:'ring',x:p.x,y:p.y,r0:10,r1:105,t:0,max:0.35,col:'#ffcc88'});if(hasPw('quake'))earthshatterAt(p.x,p.y);leapMods(p,L);}}
  else if(ml>0.08){const spd=165*(1+s.move/100)*(p.spin>0?1.3:1)*(G.terrain[tileIdx(p.x,p.y)]===T_POISON?0.55:1)*(p.slowT>0?1-p.slowAmt:1);moveEnt(p,mx*spd*dt,my*spd*dt);if(p.spin<=0)p.face=Math.atan2(my,mx);}
  if(!G.inTown&&!p.dead&&!p.leap){const t=G.terrain[tileIdx(p.x,p.y)];
    if(t===T_LAVA){p.burnT=(p.burnT||0)-dt;if(p.burnT<=0){p.burnT=0.4;burnPlayer(s.life*0.04*resMul('fres'));burst(p.x,p.y,5,'#ff8a2a',90);}}else p.burnT=0;
    if(t===T_POISON&&Math.random()<dt*8)G.parts.push({x:p.x+rand(-12,12),y:p.y+rand(-6,10),vx:0,vy:-30,life:0.5,max:0.5,col:'#9fe04a',s:3});}
  if(!G.inTown&&Math.random()<0.5){const i=Math.floor(p.x/TILE)+randi(-9,9),j=Math.floor(p.y/TILE)+randi(-7,7);
    if(i>=0&&j>=0&&i<MW&&j<MH){const k=j*MW+i,t=G.terrain[k],lava=t===T_LAVA||G.grid[k]===2&&ACTS[actIdx(G.depth)].gen==='ember';
      if(lava||t===T_POISON)G.parts.push({x:(i+Math.random())*TILE,y:(j+Math.random())*TILE,vx:rand(-8,8),vy:lava?-rand(30,70):-12,life:lava?0.9:0.7,max:0.9,col:lava?'#ffb040':'#b8ff5a',s:lava?2.5:3});}}
  if(p.spin>0){p.spin-=dt;p.spinTick-=dt;if(p.spinTick<=0){p.spinTick=0.25;if(hasPw('pull'))pullIn(240,45);G.sk=p.spinSk??null;const n=aoe(p.x,p.y,88,p.spinMult,{});if(n&&hasMod('bloodspin'))healPlayer(G.stats.life*0.005*Math.min(n,4),true);G.sk=null;}spinMods(p,dt);}
  if(G.stats.pw&&Object.keys(G.stats.pw).length)powerTick(dt);
  encounterTick(dt);portalTick(dt); /* portal.js */
  for(let i=0;i<5;i++)if(held[i])tryCast(i);
  if(keys.KeyJ||keys.Space||keys.Digit1)tryCast(0);
  for(let i=1;i<5;i++)if(keys['Digit'+(i+1)])tryCast(i);
  // flow field
  G.flowT-=dt;if(G.flowT<=0){G.flowT=0.25;computeFlow();}
  // enemies
  for(const e of G.enemies){
    if(e.dead)continue;e.flash-=dt;
    if(e.stunCd>0)e.stunCd-=dt;
    if(e.shieldT>0)e.shieldT-=dt;
    if(e.bleedT>0){e.bleedT-=dt;const b=e.bleedDps*dt;e.hp-=b;bossGate(e);e.bleedAcc=(e.bleedAcc||0)+b;e.bleedTick=(e.bleedTick||0)-dt;
      if(Math.random()<dt*6)G.parts.push({x:e.x+rand(-e.r,e.r)*0.6,y:e.y,vx:rand(-15,15),vy:rand(20,60),life:0.5,max:0.5,col:'#b01818',s:3});
      if(e.bleedTick<=0&&e.bleedAcc>=1){e.bleedTick=0.6;floatText(e.x+rand(-6,6),e.y-e.r-6,Math.round(e.bleedAcc),'#e04040',false);e.bleedAcc=0;}
      if(e.hp<=0){killEnemy(e);continue;}}
    if(ailTick(e,dt)){killEnemy(e);continue;} // ailments.js: poison, shock, chill timers
    if(e.burnT>0){e.burnT-=dt;const b=e.burnDps*dt;e.hp-=b;bossGate(e);e.burnAcc=(e.burnAcc||0)+b;e.burnTick=(e.burnTick||0)-dt;
      if(Math.random()<dt*8)G.parts.push({x:e.x+rand(-e.r,e.r)*0.6,y:e.y-rand(0,e.r),vx:rand(-10,10),vy:rand(-70,-30),life:0.45,max:0.45,col:'#ff8a2a',s:3});
      if(e.burnTick<=0&&e.burnAcc>=1){e.burnTick=0.6;floatText(e.x+rand(-6,6),e.y-e.r-6,Math.round(e.burnAcc),'#ff9a4a',false);e.burnAcc=0;}
      if(e.hp<=0){killEnemy(e);continue;}}
    if(e.spawnT>0)e.spawnT-=dt;
    if(e.type==='boss'&&!e.introDone&&G.time-(G.areaT||0)>2.4&&Math.hypot(e.x-G.p.x,e.y-G.p.y)<430){/* after the area title has faded */e.introDone=true;bossIntro(e);} // sprites.js: the entrance
    if(e.introT>0){e.introT-=dt;if(e.introT>1.2&&Math.random()<dt*10)burst(e.x+rand(-e.r,e.r),e.y+e.r*0.6,3,'#8a7a62',90);continue;}
    if(e.type==='boss'&&bossFrame(e,dt))continue; /* bossfight.js: phase transitions, shields, arena, enrage */
    const T=ETYPES[e.type];
    if(T.regen&&e.hp<e.maxHp&&G.time-(e.lastHit||-9)>2&&!(e.bleedT>0)){ // troll regen; bleeding stops it
      e.hp=Math.min(e.maxHp,e.hp+e.maxHp*T.regen*dt);if(Math.random()<dt*5)G.parts.push({x:e.x+rand(-e.r,e.r)*0.7,y:e.y+rand(-e.r,e.r)*0.5,vx:0,vy:-35,life:0.6,max:0.6,col:'#7fe060',s:3});}
    if(e.stun>0){e.stun-=dt;continue;}if(e.frozen>0){e.frozen-=dt;continue;}
    if(e.fearT>0){fleeStep(e,dt);continue;} // skillmods.js: Terrify
    const d=dist(e,p);
    if(!e.aggro&&d<(T.ai==='turret'?400:360))aggroPack(e);
    if(!e.aggro||p.dead)continue;
    if(e.affs&&e.affs.length)affixTick(e,d,dt);
    if(e.busy>0)e.busy-=dt;else e.cd-=dt; // bosses don't count down to the next move mid-pattern
    const toP=Math.atan2(p.y-e.y,p.x-e.x);e.face=e.wind>0&&e.lockA!=null?e.lockA:toP; /* big attacks keep their aim */
    if(e.dash>0){e.dash-=dt;moveEnt(e,e.dvx*dt,e.dvy*dt);if(!e.dashHit&&dist(e,p)<e.r+p.r+6){e.dashHit=true;dmgPlayer(e.dashDmg||e.dmg*1.5,e);G.shake=8;}continue;}
    if(e.wind>0){e.wind-=dt;if(e.wind<=0){const act=e.act;e.act=null;e.tele=null;e.lockA=null;
      if(typeof act==='function')act();
      else if(act==='charge'){e.dash=0.5;e.dashHit=false;e.dvx=Math.cos(e.chargeA)*560;e.dvy=Math.sin(e.chargeA)*560;}
      else if(act==='slam'){if(d<120+p.r)dmgPlayer(e.dmg*1.3,e);G.shake=10;G.fx.push({type:'ring',x:e.x,y:e.y,r0:10,r1:125,t:0,max:0.3,col:'#ff4a3a'});}
      else if(d<e.r+p.r+T.range+14)dmgPlayer(e.dmg,e);}continue;}
    const slow=(G.terrain[tileIdx(e.x,e.y)]===T_POISON?0.6:1)*chillMul(e); // ailments.js
    const step=(ang,mul)=>moveEnt(e,Math.cos(ang)*e.spd*mul*slow*dt,Math.sin(ang)*e.spd*mul*slow*dt);
    const chase=()=>{const a=d<TILE*1.6?toP:(flowDir(e)??toP);step(a,1);};
    AI[T.ai](e,T,d,toP,step,chase,e.cdMul||1,dt);
    if(T.trail){e.trailT=(e.trailT||0)-dt;if(e.trailT<=0){e.trailT=0.35;addEHaz(e.x,e.y,24,2.6,e.dmg*0.5,'fire');}}
  }
  // separation
  const al=G.enemies.filter(e=>!e.dead&&e.aggro&&!e.hidden);
  for(let i=0;i<al.length;i++)for(let j=i+1;j<al.length;j++){const a=al[i],b=al[j];const dx=b.x-a.x,dy=b.y-a.y,dd=Math.hypot(dx,dy),m=a.r+b.r;if(dd<m&&dd>0.01){const push=(m-dd)*0.5,nx=dx/dd,ny=dy/dd;if(a.spd)moveEnt(a,-nx*push,-ny*push);if(b.spd)moveEnt(b,nx*push,ny*push);}}
  if(G.enemies.length>0&&G.enemies.every(e=>e.dead)===false&&G.time%5<dt)G.enemies=G.enemies.filter(e=>!e.dead);
  // projectiles
  for(const q of G.proj){
    if(q.home)homeIn(q,dt);
    q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;
    if(wallAt(Math.floor(q.x/TILE),Math.floor(q.y/TILE))){q.life=0;if(q.explode)explodeAt(q.x-q.vx*dt,q.y-q.vy*dt,q.explode,q.mult);continue;}
    if(q.from==='p'){let hit=false;G.sk=q.sk??null;for(const e of G.enemies){if(e.dead||e.hidden)continue;if(Math.hypot(e.x-q.x,e.y-q.y)<e.r+q.r){if(q.hits&&q.hits.has(e))continue;const life=q.life;q.life=0;hit=true;if(q.explode){explodeAt(q.x,q.y,q.explode,q.mult);if(q.onhit)q.onhit();}else{hitEnemy(e,q.mult,{weapon:q.weapon});if(q.onhit)q.onhit();
        if(q.pierce>0){q.pierce--;q.life=life;hit=false;(q.hits||(q.hits=new Set())).add(e);continue;}}break;}}
      if(!hit&&q.life<=0&&q.explode)explodeAt(q.x,q.y,q.explode,q.mult);G.sk=null;}
    else if(!p.dead&&Math.hypot(p.x-q.x,p.y-q.y)<p.r+q.r){q.life=0;if(dmgPlayer(q.dmg,q.src)&&q.slow)slowPlayer(q.slow,1.6);if(q.r>=7)burst(q.x,q.y,8,q.col,120);}
  }
  G.proj=G.proj.filter(q=>q.life>0);
  // enemy ground hazards: poison clouds slow and hurt, fire patches burn (armor halves it)
  let dot=0;
  for(const h of G.ehaz){h.t-=dt;if(Math.random()<dt*3)G.parts.push({x:h.x+rand(-h.r,h.r)*0.6,y:h.y+rand(-h.r,h.r)*0.6,vx:0,vy:-25,life:0.6,max:0.6,col:h.kind==='poison'?'#b8ff5a':'#ffa040',s:3});
    if(!p.dead&&!p.leap&&Math.hypot(p.x-h.x,p.y-h.y)<h.r+p.r*0.4){dot+=h.dps*dt*resMul(HAZ_RES[h.kind]);p.dotCol=h.kind==='poison'?'#9fe04a':h.kind==='frost'?'#bfe8ff':'#ff9a3a';if(h.kind==='poison')slowPlayer(0.3,0.3);else if(h.kind==='frost')slowPlayer(0.4,0.4);}}
  G.ehaz=G.ehaz.filter(h=>h.t>0);
  if(dot>0)p.dotAcc=(p.dotAcc||0)+dot*bossTakenMul()*(1-Math.min(0.75,s.armor/(s.armor+30+10*PD()))*0.5);
  p.dotT=(p.dotT||0)-dt;if(p.dotT<=0){p.dotT=0.4;if(p.dotAcc>=1){burnPlayer(p.dotAcc,p.dotCol);p.dotAcc=0;}}
  // hazards
  for(const h of G.hazards){h.t-=dt;h.tick-=dt;if(h.tick<=0){h.tick=0.5;G.sk=h.sk??null;aoe(h.x,h.y,h.r,h.mult,h.quiet?{quiet:true,splashed:true,dot:true,haz:true}:{haz:true});G.sk=null;}if(Math.random()<0.5)G.parts.push({x:h.x+rand(-h.r,h.r)*0.8,y:h.y+rand(-h.r,h.r)*0.8,vx:0,vy:-40,life:0.5,max:0.5,col:h.rot?'#9fe04a':'#ff7a2a',s:3});}
  G.hazards=G.hazards.filter(h=>h.t>0);
  for(const dl of G.delayed){dl.t-=dt;if(dl.t<=0&&!dl.done){dl.done=true;const was=G.sk;G.sk=dl.sk??null;dl.fn();G.sk=was;}} // a delayed hit keeps its skill
  G.delayed=G.delayed.filter(dl=>!dl.done);
  // loot
  for(const l of G.loot){l.t+=dt;if(p.dead||l.taken||(l.item&&lootHidden(l.item)))continue;const d=Math.hypot(l.x-p.x,l.y-p.y);
    if(l.gold&&d<60){l.x+=(p.x-l.x)*Math.min(1,dt*10);l.y+=(p.y-l.y)*Math.min(1,dt*10);}
    if(d<32){if(l.gem)pickStone(l);else if(l.cur)pickCur(l);else if(l.sig)pickSigil(l);else if(l.eng)pickEng(l);else if(l.gold){const v=Math.round(l.gold*(1+(G.stats.gold||0)/100));G.char.gold+=v;l.taken=true;playSfx('gold');floatText(p.x,p.y-30,'+'+v+' gold','#f2d04a',false);}
      else if(autoSalvages(G.char,l.item)){const r=autoSalvage(G.char,l.item);l.taken=true;floatText(l.x,l.y-20,`+${r.gold}🪙 ${matText(r.mats)}`,RCOL[0],false);}
      else if(G.char.bag.length<30){G.char.bag.push(l.item);l.taken=true;playSfx('pickup');noteSetPiece(l.item);floatText(l.x,l.y-20,l.item.name,RCOL[l.item.rarity],false);$('bagDot').classList.remove('hidden');}
      else if(G.bagFullT<=0){G.bagFullT=3;toast('Bag is full','Salvage items in 🎒');}}}
  G.loot=G.loot.filter(l=>!l.taken);
  // fx
  for(const f of G.fx)f.t+=dt;G.fx=G.fx.filter(f=>f.t<f.max);
  for(const q of G.parts){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=0.92;q.vy*=0.92;q.life-=dt;}G.parts=G.parts.filter(q=>q.life>0);
  for(const t of G.texts){t.t+=dt;t.y-=40*dt;}G.texts=G.texts.filter(t=>t.t<0.9);
  if(G.inTown)townTick(dt);
  // explore
  G.exploreT-=dt;if(G.exploreT<=0){G.exploreT=0.15;const tx=Math.floor(p.x/TILE),ty=Math.floor(p.y/TILE);for(let j=-8;j<=8;j++)for(let i=-8;i<=8;i++){if(i*i+j*j>64)continue;const x=tx+i,y=ty+j;if(x>=0&&y>=0&&x<MW&&y<MH)G.explored[y*MW+x]=1;}}
  // portal
  const nearPortal=G.portal.active&&Math.hypot(p.x-G.portal.x,p.y-G.portal.y)<70&&!p.dead;
  if(G.zone&&!G.inTown)zonePortals(p); /* zones.js: locked exits, side passages */
  else{const b=$('descBtn'),t=G.atTp?`🌀 ${ZONES[G.tpBack.zid].name}`:nearPortal?townGateLabel():'';if(b.textContent!==t&&t)b.textContent=t;b.classList.toggle('hidden',!t);b.classList.remove('dis');}
  const nearMerchant=G.inTown&&G.merchant&&!p.dead&&Math.hypot(p.x-G.merchant.x,p.y-G.merchant.y)<85;
  $('shopBtn').classList.toggle('hidden',!nearMerchant);
  const nearStash=G.inTown&&G.stash&&!p.dead&&Math.hypot(p.x-G.stash.x,p.y-G.stash.y)<70;
  $('stashBtn').classList.toggle('hidden',!nearStash);
  const nearSmith=G.inTown&&G.smith&&!p.dead&&Math.hypot(p.x-G.smith.x,p.y-G.smith.y)<85;
  $('smithBtn').classList.toggle('hidden',!nearSmith);
  const nearBench=G.inTown&&G.bench&&!p.dead&&Math.hypot(p.x-G.bench.x,p.y-G.bench.y)<75;
  $('benchBtn').classList.toggle('hidden',!nearBench);
  const nearWay=G.inTown&&G.waystone&&!p.dead&&!nearPortal&&Math.hypot(p.x-G.waystone.x,p.y-G.waystone.y)<70;
  $('wayBtn').classList.toggle('hidden',!nearWay);
  // camera
  G.cam.x+=(p.x-G.cam.x)*Math.min(1,dt*8);G.cam.y+=(p.y-G.cam.y)*Math.min(1,dt*8);
  G.shake=Math.max(0,G.shake-dt*40);
  G.saveT+=dt;if(G.saveT>30){G.saveT=0;saveChar();}
}
