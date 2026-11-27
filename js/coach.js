'use strict';
// v1.0.163: the first fight (roadmap: the first 10 minutes). Light prompts, one at a time, each only when it's
// needed and only once per phone (stored with the hints; Settings › Controls: Hints off turns them off too): move,
// attack, dodge, drink a potion, pick up loot, equip it, learn the new skill. A prompt never pauses the game; it
// shows in its own box above the controls, makes its button glow, and goes as soon as the player has done it.
// Early loot for every new hero (c.early): the 3rd kill drops a magic body armour (an easy first upgrade), the 10th
// kill (or the first elite) a rare, and the first Mourning Fields boss a unique. Then normal drops take over.
const COACH={cur:null,t:0,base:null};
// [key, prompt, button to glow (id, or 'sk0' for the first skill), when it shows, when it's done]
const COACH_STEPS=[
  ['move','Drag on the left side of the screen to move (keyboard: WASD).',null,()=>true,()=>COACH.base&&Math.hypot(G.p.x-COACH.base.x,G.p.y-COACH.base.y)>140],
  ['attack','An enemy! Hold your big skill button to attack it.','sk0',()=>G.enemies.some(e=>!e.dead&&e.aggro&&Math.hypot(e.x-G.p.x,e.y-G.p.y)<360),()=>(G.char.kills||0)>COACH.base.kills],
  ['dodge','Tap 💨 to dodge through an attack: you can\'t be hit while you roll.','dodgeBtn',()=>G.p.hp<G.stats.life*0.85,()=>!!G.p.dodge],
  ['potion','Low on life: tap 🧪 to drink a potion. Potions refill in town.','potBtn',()=>G.p.hp<G.stats.life*0.45&&G.p.potions>0,()=>G.p.potions<COACH.base.pot||G.p.hp>=G.stats.life*0.8],
  ['loot','Loot! Walk over it to pick it up.',null,()=>G.loot.some(l=>!l.taken&&l.item&&Math.hypot(l.x-G.p.x,l.y-G.p.y)<300),()=>G.char.bag.length>COACH.base.bag],
  ['equip','Open 🎒 and tap the new item to wear it.','bagBtn',()=>G.char.bag.some(it=>it&&it.rarity>=1),()=>EQ_SLOTS.filter(s=>G.char.equip[s]).length>COACH.base.eq],
  ['skill','Level up! Tap ✨ to learn a new skill.','skBtn',()=>G.char.skillPts>0&&G.char.lvl>=2,()=>G.char.skills[1]>0||G.char.skillPts===0]];
// only for heroes made since v1.0.163 (c.coach), and not for a player who already has a hero of level 10 or more
function coachOn(){const c=G.char;return SETTINGS.hints!==false&&!!c&&!!G.p&&!INTRO.on&&!!c.coach&&!SAVES.some(s=>s&&s.id!==c.id&&(s.lvl||0)>=10);}
function coachBase(){const c=G.char,p=G.p;COACH.base={x:p.x,y:p.y,kills:c.kills||0,pot:p.potions,bag:c.bag.length,eq:EQ_SLOTS.filter(s=>c.equip[s]).length};}
function coachGlow(id,on){const el=id==='sk0'?document.querySelector&&document.querySelector('#skills .sk'):$(id);if(el&&el.classList)el.classList.toggle('coach',on);}
function coachShow(s){COACH.cur=s;COACH.t=0;coachBase();const b=$('coachBox');b.textContent=s[1];b.classList.remove('hidden');if(s[2])coachGlow(s[2],true);}
function coachDone(){const s=COACH.cur;if(!s)return;HINT.seen['coach_'+s[0]]=1;storeHints();if(s[2])coachGlow(s[2],false);$('coachBox').classList.add('hidden');COACH.cur=null;}
// every frame of play (game.js update)
function coachTick(dt){if(!coachOn()){if(COACH.cur){if(COACH.cur[2])coachGlow(COACH.cur[2],false);$('coachBox').classList.add('hidden');COACH.cur=null;}return;}
  if(COACH.cur){COACH.t+=dt;if(COACH.cur[4]()||COACH.t>25)coachDone();return;}
  if(!COACH.base)coachBase();
  for(const s of COACH_STEPS){if(HINT.seen['coach_'+s[0]])continue;if(s[3]()){coachShow(s);if(s[4]())coachDone();break;}}} // the first one that's needed now, in this order
// Early loot (game.js killEnemy; heroes made since v1.0.163, c.coach): true when this kill dropped the hero's guaranteed early item
function earlyLoot(e){const c=G.char;if(!c.coach)return false;const E=c.early||(c.early={});if(e.summoned||e.noLoot||e.su||e.zb||e.type==='boss')return false;
  if(!E.magic&&(c.kills||0)>=3&&c.lvl<=4){E.magic=1;dropItem(e.x,e.y,genItem(PD(),c.cls,0,'body',1));return true;}
  if(E.magic&&!E.rare&&((c.kills||0)>=10||e.elite)&&c.lvl<=6){E.rare=1;dropItem(e.x,e.y,rollDrop(c,PD()+1,1,2,{act:dropAct(PD())}));return true;}
  return false;}
// the first Mourning Fields boss: a unique (zones.js zoneBossDown)
function earlyUnique(e){const c=G.char;if(!c.coach)return;const E=c.early||(c.early={});if(E.uq||G.zone!=='a1z1')return;E.uq=1;dropItem(e.x+20,e.y+10,rollDrop(c,PD()+1,3,3,{act:1}));}
