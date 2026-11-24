'use strict';
// Items: slots, weapon/armor archetypes, icons, affixes, drops, generation, save migration, character stats.
// ---------- data ----------
const TILE=40,MW=64,MH=64;
// Equipment slots, in paper-doll display order (5 columns × 2 rows).
const EQ_SLOTS=['mainhand','ring1','helm','amulet','offhand','gloves','ring2','body','belt','boots'];
const SLOT_NAME={mainhand:'Main Hand',offhand:'Off Hand',helm:'Helm',body:'Body',gloves:'Gloves',belt:'Belt',boots:'Boots',amulet:'Amulet',ring1:'Ring 1',ring2:'Ring 2'};
// Item types: which slots they fit, drop weight (w = % of drops; shield and focus share the off-hand 10%, one per class), and affix pool.
const TYPES={
  weapon:{name:'Weapon',slots:['mainhand','offhand'],w:20,pool:['dmg','crit','critd','aspd','loh','life','res','spell','skdmg','bossdmg','igniteCh','shockCh','poisonCh']},
  shield:{name:'Shield',slots:['offhand'],w:10,cls:'warden',pool:['armor','life','regen','block','res','loh','resist','ares','thorns','dr']},
  focus:{name:'Focus',slots:['offhand'],w:10,cls:'arcanist',pool:['spell','res','cdr','crit','regen','life','skdmg','bossdmg','igniteCh','shockCh','poisonCh']},
  helm:{name:'Helm',slots:['helm'],w:10,pool:['life','armor','crit','cdr','res','regen','resist','lifepct','evade']},
  body:{name:'Body Armor',slots:['body'],w:14,pool:['life','armor','regen','res','cdr','resist','lifepct','thorns','dr']},
  gloves:{name:'Gloves',slots:['gloves'],w:10,pool:['aspd','crit','critd','dmg','loh','armor','resist','skdmg','evade','igniteCh','shockCh','poisonCh']},
  belt:{name:'Belt',slots:['belt'],w:10,pool:['life','pot','armor','regen','res','resist','lifepct','dr']},
  boots:{name:'Boots',slots:['boots'],w:10,pool:['move','life','armor','regen','cdr','resist','evade']},
  amulet:{name:'Amulet',slots:['amulet'],w:6,pool:null}, // null = any affix
  ring:{name:'Ring',slots:['ring1','ring2'],w:10,pool:['life','res','dmg','crit','critd','aspd','cdr','loh','regen','armor','spell','resist','ares','bossdmg','skdmg','igniteCh','shockCh','poisonCh']}
};
// ---------- base tiers: each act adds a tier (Tier I in act 1 … Tier V in act 5) ----------
// A base's tier sets its base level, which drives base damage, armor and implicit values; item level only nudges it
// within the tier, so a plain white base from a later act beats an old base. Rings and amulets have no base stats and no tier.
// Tier starts are set so a white base at the start of an act has ~20% more base damage/armor than a rare
// (whose base is 10% higher) of the previous tier at the end of the act before. Tier I follows item level
// through act 1, like all bases did before tiers; later tiers only grow slowly with item level.
const TIER_LO=[1,6,11,16,21];            // first item level of each tier's act
const TIER_BL=[1,7.25,11.8,17.8,25.75];  // base level at that point
const TIERED=new Set(['weapon','shield','focus','helm','body','gloves','belt','boots']);
function baseLvl(t,ilvl){if(t===1)return Math.max(1,Math.min(ilvl,5))+Math.max(0,ilvl-5)*0.3;
  return TIER_BL[t-1]+Math.max(0,ilvl-TIER_LO[t-1])*0.3+(t===5?Math.max(0,ilvl-25)*0.7:0);} // Tier V keeps climbing in the endless depths
const tierOfLvl=l=>Math.min(5,Math.floor((Math.max(1,l)-1)/5)+1);
const dropAct=d=>d>25?5:actIdx(d)+1;  // the act whose tiers drop at depth d (endless drops Tier V)
// Drops in act a: 70% Tier a, 20% Tier a-1, 10% any older tier. Bosses always drop their act's tier.
// Item Rarity also makes an older tier a little less likely: +25% turns 70% current tier into 77.5%.
function rollTier(a,top,rar=0){if(top||a<=1)return a;const r=Math.random();if(r<0.7+0.3*Math.min(0.5,rar/100))return a;if(r<0.9||a===2)return a-1;return randi(1,a-2);}
const TIER_NAME=['I','II','III','IV','V'];
// Weapon archetypes. act = the act (and tier) it first drops in; bases = one name per tier from that act on.
// dmg/spd multiply base damage and attack rate; arc/reach shape Cleave; anim picks the attack animation.
// Built-in properties: crit, critd, bleed, stun (+stunDur), spell, block, splash (% of a weapon hit dealt to enemies
// near the target), pierce (bolts pass through N enemies), explode (% damage burst when you slay an enemy),
// skill (+N to one random skill, rolled when the item drops).
const WEAPONS={
  sword:{name:'Sword',cls:'warden',act:1,hands:1,dmg:1,spd:1,block:5,arc:1.1,reach:78,anim:'swing',bases:['Arming Sword','Broadsword','Knight Sword','Glacial Longsword','Cinderforged Blade']},
  axe:{name:'Axe',cls:'warden',act:1,hands:1,dmg:1.05,spd:0.95,bleed:20,arc:1.1,reach:76,anim:'swing',bases:['Hand Axe','War Axe','Bearded Axe','Frostbite Axe','Magma Axe']},
  mace:{name:'Mace',cls:'warden',act:1,hands:1,dmg:1.05,spd:0.9,stun:12,stunDur:0.7,arc:1,reach:74,anim:'swing',bases:['Cudgel','Flanged Mace','Morning Star','Rime Mace','Ember Mace']},
  dagger:{name:'Dagger',cls:'warden',act:1,hands:1,dmg:0.62,spd:1.5,crit:6,arc:0.75,reach:64,anim:'stab',bases:['Dirk','Stiletto','Kris','Ice Fang','Cinder Shiv']},
  greatsword:{name:'Greatsword',cls:'warden',act:1,hands:2,dmg:1.85,spd:0.7,critd:15,arc:1.6,reach:96,anim:'heavy',bases:['Greatsword','Claymore','Zweihander','Glacier Blade','Ashen Colossus']},
  maul:{name:'Maul',cls:'warden',act:1,hands:2,dmg:2.05,spd:0.6,stun:25,stunDur:1,arc:1.4,reach:90,anim:'heavy',bases:['Maul','War Hammer','Great Mace','Avalanche Maul','Molten Maul']},
  scimitar:{name:'Scimitar',cls:'warden',act:2,hands:1,dmg:0.95,spd:1.12,critd:20,arc:1.25,reach:76,anim:'swing',bases:['Scimitar','Bog Scimitar','Frost Scimitar','Sunfire Scimitar']},
  spear:{name:'Spear',cls:'warden',act:2,hands:2,dmg:1.55,spd:0.8,arc:0.5,reach:132,anim:'thrust',bases:['Spear','Pike','Frost Lance','Hellfire Glaive']},
  flail:{name:'Flail',cls:'warden',act:3,hands:1,dmg:1,spd:0.92,splash:35,arc:1.1,reach:84,anim:'swing',bases:['Flail','Frost Flail','Ember Flail']},
  greataxe:{name:'Greataxe',cls:'warden',act:3,hands:2,dmg:1.95,spd:0.66,bleed:35,arc:1.5,reach:92,anim:'heavy',bases:['Greataxe','Glacial Bardiche','Headsman of Embers']},
  runeblade:{name:'Runeblade',cls:'warden',act:4,hands:1,dmg:1,spd:1.05,skill:1,arc:1.1,reach:80,anim:'swing',bases:['Runeblade','Ember Runeblade']},
  demonblade:{name:'Demon Blade',cls:'warden',act:5,hands:1,dmg:1.05,spd:1,explode:40,arc:1.15,reach:80,anim:'swing',bases:['Demon Blade']},
  wand:{name:'Wand',cls:'arcanist',act:1,hands:1,dmg:0.85,spd:1.3,crit:3,anim:'flick',bases:['Bone Wand','Yew Wand','Glass Wand','Frost Wand','Ember Wand']},
  scepter:{name:'Scepter',cls:'arcanist',act:1,hands:1,dmg:1,spd:1,spell:10,anim:'flick',bases:['Iron Scepter','Sun Scepter','Bog Scepter','Crystal Scepter','Ember Scepter']},
  staff:{name:'Staff',cls:'arcanist',act:1,hands:2,dmg:1.4,spd:0.85,spell:20,anim:'thrust',bases:['Oak Staff','Runed Staff','Elder Staff','Frost Staff','Cinder Staff']},
  rod:{name:'Rod',cls:'arcanist',act:2,hands:1,dmg:0.95,spd:1.1,pierce:1,anim:'flick',bases:['Sand Rod','Bog Rod','Ice Rod','Magma Rod']},
  thornstaff:{name:'Thornstaff',cls:'arcanist',act:3,hands:2,dmg:1.35,spd:0.85,spell:10,splash:35,poison:25,anim:'thrust',bases:['Thornstaff','Frostthorn Staff','Emberthorn Staff']},
  runewand:{name:'Runewand',cls:'arcanist',act:4,hands:1,dmg:0.9,spd:1.25,skill:1,anim:'flick',bases:['Runewand','Ember Runewand']},
  spellblade:{name:'Spellblade',cls:'arcanist',act:2,hands:1,dmg:0.95,spd:1.1,spell:8,crit:2,anim:'flick',bases:['Spellblade','Bog Spellblade','Frost Spellblade','Sunfire Spellblade']}, // v1.0.71
  demonstaff:{name:'Demon Staff',cls:'arcanist',act:5,hands:2,dmg:1.45,spd:0.85,spell:15,explode:40,anim:'thrust',bases:['Demon Staff']}
};
const FIST={name:'Fists',hands:1,dmg:1,spd:1,arc:1.1,reach:72,anim:'swing'};
// Base names used before tiers existed (saves from v2 have no weapon type, only these names).
const OLD_BASES={sword:['Broadsword','Falchion','Arming Sword'],axe:['War Axe','Cleaver','Hand Axe'],mace:['Flanged Mace','Morning Star','Cudgel'],dagger:['Dirk','Stiletto','Kris'],
  greatsword:['Greatsword','Claymore','Zweihander'],greataxe:['Greataxe','Bardiche','Headsman Axe'],maul:['Maul','War Hammer','Great Mace'],
  wand:['Bone Wand','Yew Wand','Glass Wand'],scepter:['Ember Scepter','Crystal Rod','Iron Scepter'],staff:['Oak Staff','Runed Staff','Elder Staff']};
const BASE_WT={};for(const k in WEAPONS)for(const b of WEAPONS[k].bases)BASE_WT[b]=k;for(const k in OLD_BASES)for(const b of OLD_BASES[k])BASE_WT[b]=k;
// Other bases, one list of names per tier.
const FOCUS={orb:{name:'Orb',bases:[['Orb'],['Seer Orb'],['Marsh Orb'],['Frost Orb'],['Ember Orb']]},tome:{name:'Tome',bases:[['Tome'],['Grimoire'],['Codex'],['Frost Codex'],['Demon Grimoire']]}};
const wOf=it=>it&&it.slot==='weapon'?WEAPONS[it.wt]||FIST:null;
const is2h=it=>{const w=wOf(it);return !!w&&w.hands===2;};
// Which slots this character can put the item in (class rules, one-hand vs two-hand).
function fitsFor(c,it){const T=TYPES[it.slot];if(!T||(T.cls&&T.cls!==c.cls))return [];
  if(it.slot==='weapon'){const w=WEAPONS[it.wt];if(!w||w.cls!==c.cls)return [];return w.hands===1&&c.cls==='warden'?['mainhand','offhand']:['mainhand'];}
  return T.slots;}
const slotOpen=(eq,sl)=>sl!=='offhand'||!is2h(eq.mainhand);
const TYPE_KEYS=Object.keys(TYPES);
const SLOT_TYPE={mainhand:'weapon',offhand:'shield',helm:'helm',body:'body',gloves:'gloves',belt:'belt',boots:'boots',amulet:'amulet',ring1:'ring',ring2:'ring'};
// Body armor kinds: armor multiplier, optional implicit affix.
const BODY={
  robe:{name:'Robe',arm:0.5,imp:'res',bases:[['Robe'],['Silk Robe'],['Vestment'],['Frostweave Robe'],['Cinder Mantle']]},
  leather:{name:'Leather Armor',arm:0.8,imp:'regen',bases:[['Leather Vest'],['Studded Leather'],['Hide Tunic'],['Frostfur Coat'],['Drake Leather']]},
  chain:{name:'Chain Armor',arm:1.1,bases:[['Ring Mail'],['Chain Mail'],['Scale Coat'],['Rime Mail'],['Ember Mail']]},
  plate:{name:'Plate Armor',arm:1.4,bases:[['Breastplate'],['Plate Armor'],['Full Plate'],['Glacial Plate'],['Demon Plate']]}
};
const ARM={helm:[3,1.5],shield:[4,2],gloves:[1.5,0.8],boots:[1.5,0.8]};
// Weapon built-in properties as item-card lines.
function weaponProps(w){const out=[];
  if(w.crit)out.push(`+${w.crit}% Crit Chance`);if(w.critd)out.push(`+${w.critd}% Crit Damage`);if(w.spell)out.push(`+${w.spell}% Spell Damage`);
  if(w.block)out.push(`+${w.block}% Block Chance`);
  if(w.bleed)out.push(`${w.bleed}% chance to Bleed (80% of hit over 3s)`);if(w.poison)out.push(`${w.poison}% chance to Poison (60% of hit over 3s, stacks)`);if(w.stun)out.push(`${w.stun}% chance to Stun for ${w.stunDur}s`);
  if(w.splash)out.push(`Hits splash ${w.splash}% damage onto nearby enemies`);if(w.pierce)out.push(`Bolts pierce ${w.pierce} enemy`);
  if(w.explode)out.push(`Slain enemies explode for ${w.explode}% damage`);if(w.reach>=110)out.push('Long reach');
  if(w.skill)out.push(`+${w.skill} to a random skill`);
  return out;}

// ---------- item icons (inline SVG, one per item type / weapon kind / armor kind) ----------
const ICON={
  sword:'<path d="M9 23L25 7h1v1L10 24z" fill="#cfd6dc" stroke="#7d8790"/><path d="M6.5 19.5l6 6" stroke="#c9a24a" stroke-width="2.5" stroke-linecap="round"/><path d="M9 23l-4 4" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/><circle cx="4.5" cy="27.5" r="1.8" fill="#c9a24a"/>',
  axe:'<path d="M8 27L21 7" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/><path d="M17 6c4-3 10-1 11 4-3 0-6 2-7 5l-5-3c1-2 1-4 1-6z" fill="#bfc6cc" stroke="#6e767d"/>',
  mace:'<path d="M7 27l11-13" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/><circle cx="21" cy="10" r="5.5" fill="#9aa3aa" stroke="#5c646b"/><path d="M21 2v3M21 15v3M13 10h3M26 10h3M15.5 4.5l2 2M24.5 13.5l2 2M26.5 4.5l-2 2" stroke="#5c646b" stroke-width="2" stroke-linecap="round"/>',
  staff:'<path d="M9 29L20 8" stroke="#8a5f35" stroke-width="3" stroke-linecap="round"/><circle cx="21.5" cy="6.5" r="4" fill="#b98cff" stroke="#6a3fb5"/><circle cx="20.5" cy="5.5" r="1.3" fill="#fff"/>',
  dagger:'<path d="M12 20L24 8h1.5v1.5L13.5 21.5z" fill="#d8dee3" stroke="#7d8790"/><path d="M10 18l4 4" stroke="#c9a24a" stroke-width="2.4" stroke-linecap="round"/><path d="M12 20l-5 5" stroke="#4a2e17" stroke-width="3" stroke-linecap="round"/>',
  greatsword:'<path d="M7 22L26 3h3v3L10 25z" fill="#cfd6dc" stroke="#6e767d"/><path d="M4 17l11 11" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/><path d="M8.5 23.5l-6 6" stroke="#6b4423" stroke-width="3.5" stroke-linecap="round"/>',
  greataxe:'<path d="M5 29L24 6" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/><path d="M19 3c5-2 10 2 10 7-3-1-5 0-7 2zM17.5 9c-5 1-7 6-5 10 2-2 4-3 7-3z" fill="#bfc6cc" stroke="#6e767d"/>',
  maul:'<path d="M6 29L20 12" stroke="#7a5230" stroke-width="3.2" stroke-linecap="round"/><path d="M14 8l8-6 9 10-8 6z" fill="#8f979e" stroke="#4d545a" stroke-width="1.4"/>',
  scepter:'<path d="M8 27L19 14" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="10" r="5" fill="#ff8a2a" stroke="#c9a24a" stroke-width="2"/><circle cx="22" cy="10" r="2" fill="#ffe0a0"/>',
  orb:'<circle cx="16" cy="14" r="10" fill="#6a3fb5" stroke="#c48bff" stroke-width="1.5"/><circle cx="13" cy="11" r="3.5" fill="#e6d4ff" opacity=".8"/><path d="M9 27h14" stroke="#c9a24a" stroke-width="3" stroke-linecap="round"/>',
  tome:'<path d="M6 5h17a3 3 0 0 1 3 3v19H9a3 3 0 0 1-3-3z" fill="#7a2a2a" stroke="#3a1212" stroke-width="1.2"/><path d="M9 24h17" stroke="#e8dcc4" stroke-width="2"/><path d="M16 9l3 5-3 5-3-5z" fill="#ffd36b"/>',
  wand:'<path d="M8 26L20 12" stroke="#e6dcc3" stroke-width="3" stroke-linecap="round"/><path d="M23 4l1.5 4 4 1.5-4 1.5L23 15l-1.5-4-4-1.5 4-1.5z" fill="#ffd36b"/>',
  scimitar:'<path d="M8 24C15 21 22 14 25 4c2 7-2 15-15 22z" fill="#cfd6dc" stroke="#7d8790"/><path d="M5.5 20.5l5 5" stroke="#c9a24a" stroke-width="2.5" stroke-linecap="round"/><path d="M8 23l-4 4" stroke="#6b4423" stroke-width="3" stroke-linecap="round"/>',
  spear:'<path d="M5 29L22 10" stroke="#8a5f35" stroke-width="2.6" stroke-linecap="round"/><path d="M20 12l3-8 7-1-1 7-8 3z" fill="#cfd6dc" stroke="#6e767d"/><path d="M18.5 11.5l3 3" stroke="#c9a24a" stroke-width="2.2"/>',
  flail:'<path d="M5 28l8-9" stroke="#7a5230" stroke-width="3" stroke-linecap="round"/><path d="M13 19c3-2 5-4 6.5-6.5" stroke="#8f979e" stroke-width="1.6" stroke-dasharray="1.6 1.2" fill="none"/><circle cx="22.5" cy="9.5" r="5" fill="#9aa3aa" stroke="#5c646b"/><path d="M22.5 2v3M22.5 14v3M15 9.5h3M27 9.5h3M17.5 4.5l2 2M25.5 12.5l2 2M27.5 4.5l-2 2" stroke="#5c646b" stroke-width="1.8" stroke-linecap="round"/>',
  runeblade:'<path d="M9 23L25 7h1v1L10 24z" fill="#9fc4e8" stroke="#3a6a9a"/><path d="M13 19l2-2M17 15l2-2M21 11l2-2" stroke="#7ff0ff" stroke-width="1.4"/><path d="M6.5 19.5l6 6" stroke="#c9a24a" stroke-width="2.5" stroke-linecap="round"/><path d="M9 23l-4 4" stroke="#3a2a4a" stroke-width="3" stroke-linecap="round"/>',
  demonblade:'<path d="M8 24L24 6l3-1-1 3-16 17z" fill="#3a0f10" stroke="#e0453a"/><path d="M13 19l-1-3M17 15l-1-3M21 11l-1-3" stroke="#e0453a" stroke-width="1.6" stroke-linecap="round"/><path d="M6 19.5l6.5 6.5" stroke="#8a1a1a" stroke-width="2.5" stroke-linecap="round"/><path d="M9 23l-4 4" stroke="#1a0a0a" stroke-width="3" stroke-linecap="round"/><circle cx="4.5" cy="27.5" r="1.8" fill="#ff5a3a"/>',
  rod:'<path d="M7 27L21 11" stroke="#b08a5a" stroke-width="3" stroke-linecap="round"/><path d="M24 3l3.5 5-3.5 5.5-3.5-5.5z" fill="#7fe0ff" stroke="#2e7ca8"/>',
  thornstaff:'<path d="M9 29L20 8" stroke="#5a4a2a" stroke-width="3" stroke-linecap="round"/><path d="M12 23l-3-1M15 17h3M17 13l-3-1" stroke="#8ae05a" stroke-width="1.6" stroke-linecap="round"/><circle cx="21.5" cy="6.5" r="4" fill="#8ae05a" stroke="#3a7a2a"/>',
  spellblade:'<path d="M7 27l3-3" stroke="#3a2a4a" stroke-width="3" stroke-linecap="round"/><path d="M8 21l4 4" stroke="#8a7444" stroke-width="2"/><path d="M11 22L25 7l1 2-13 15z" fill="#b8a8e0" stroke="#5a4a7a" stroke-width="1"/><circle cx="24" cy="8" r="2.5" fill="#d8a0ff" opacity=".8"/>',
  runewand:'<path d="M8 26L20 12" stroke="#9fc4e8" stroke-width="3" stroke-linecap="round"/><path d="M11 22l2-1M14 18.5l2-1M17 15l2-1" stroke="#2e7ca8" stroke-width="1.2"/><circle cx="22" cy="9" r="3.5" fill="#7ff0ff" stroke="#2e7ca8"/>',
  demonstaff:'<path d="M9 29L20 10" stroke="#3a1a1a" stroke-width="3" stroke-linecap="round"/><circle cx="21.5" cy="8" r="4.5" fill="#e8dcc4" stroke="#5a1a1a"/><path d="M18.5 5C16 3 16 1 17 0M24.5 5C27 3 27 1 26 0" stroke="#8a1a1a" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="20" cy="8" r="1" fill="#ff3a2a"/><circle cx="23" cy="8" r="1" fill="#ff3a2a"/>',
  charm_small:'<path d="M16 9l6 7-6 7-6-7z" fill="#6f8f5a" stroke="#2f3f24" stroke-width="1.4"/><circle cx="16" cy="16" r="2" fill="#d8f0b0"/>',
  charm_medium:'<rect x="9" y="6" width="14" height="20" rx="5" fill="#5a7a9a" stroke="#24364a" stroke-width="1.4"/><path d="M16 10v12M12 16h8" stroke="#cfe6ff" stroke-width="1.6" stroke-linecap="round"/>',
  charm_large:'<path d="M16 3l9 6v14l-9 6-9-6V9z" fill="#8a5a9a" stroke="#3a2446" stroke-width="1.4"/><circle cx="16" cy="16" r="4.5" fill="none" stroke="#f0d0ff" stroke-width="1.6"/><circle cx="16" cy="16" r="1.5" fill="#f0d0ff"/>',
  charm_grand:'<path d="M16 2l10 7v14l-10 7-10-7V9z" fill="#3a2a10" stroke="#f2d04a" stroke-width="2"/><path d="M16 8l2.2 5 5.3.4-4 3.5 1.3 5.2L16 19.3 11.2 22l1.3-5.2-4-3.5 5.3-.4z" fill="#f2d04a"/>',
  shield:'<path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#7a4a2a" stroke="#c9a24a" stroke-width="2"/><path d="M16 7v18M9 13h14" stroke="#c9a24a" stroke-width="2"/>',
  helm:'<path d="M6 21c0-9 4-15 10-15s10 6 10 15v5H6z" fill="#9aa3aa" stroke="#5c646b" stroke-width="1.5"/><path d="M9 16h14M16 16v8" stroke="#1a1a1a" stroke-width="2.5"/>',
  robe:'<path d="M11 4l5 3 5-3 4 4-3 4 4 17H6l4-17-3-4z" fill="#5b3f8f" stroke="#2e1f4d" stroke-width="1.2"/><path d="M16 7v22" stroke="#c9a24a" stroke-width="1.5"/><path d="M10 12h12" stroke="#c9a24a" stroke-width="1.2"/>',
  leather:'<path d="M10 4l6 3 6-3 7 5-3 5-3-2v14H9V12l-3 2-3-5z" fill="#8a5a32" stroke="#4a2e17" stroke-width="1.2"/><path d="M16 7v19" stroke="#4a2e17" stroke-width="1.2"/><circle cx="16" cy="12" r="1" fill="#d9b57a"/><circle cx="16" cy="17" r="1" fill="#d9b57a"/><circle cx="16" cy="22" r="1" fill="#d9b57a"/>',
  chain:'<path d="M10 4l6 3 6-3 7 5-3 5-3-2v14H9V12l-3 2-3-5z" fill="#8f979e" stroke="#4d545a" stroke-width="1.2"/><path d="M10 11h12M9.5 14.5h13M9.5 18h13M9.5 21.5h13M9.5 25h13" stroke="#4d545a" stroke-width="1.3" stroke-dasharray="1.4 1.2"/>',
  plate:'<path d="M4 8c2-3 5-4 7-4l5 3 5-3c2 0 5 1 7 4l-3 4-2-1v10c0 4-3 7-7 8-4-1-7-4-7-8V11l-2 1z" fill="#c3cbd2" stroke="#5c646b" stroke-width="1.4"/><path d="M16 9v19M11 16c3 1 7 1 10 0" stroke="#5c646b" stroke-width="1.3" fill="none"/>',
  gloves:'<path d="M10 28V15l-2-5c-.5-1.5 1.5-2.5 2.5-1L12 12V5c0-1.5 2.5-1.5 2.5 0v6V3.5c0-1.5 2.5-1.5 2.5 0V11V4.5c0-1.5 2.5-1.5 2.5 0V12V7c0-1.5 2.5-1.5 2.5 0v11c0 4-2 6-4 7v3z" fill="#8a5a32" stroke="#4a2e17" stroke-width="1.2"/><path d="M10 24h10" stroke="#c9a24a" stroke-width="2"/>',
  belt:'<path d="M2 12h28v8H2z" fill="#6b4423" stroke="#3a2412"/><rect x="12" y="10" width="8" height="12" rx="1" fill="none" stroke="#d9b14a" stroke-width="2.2"/><path d="M16 16h4" stroke="#d9b14a" stroke-width="2"/><circle cx="25" cy="16" r="1" fill="#3a2412"/><circle cx="7" cy="16" r="1" fill="#3a2412"/>',
  boots:'<path d="M9 3h9v15l8 4c2 1 3 3 3 5v1H7l-1-3 3-2z" fill="#7a4a2a" stroke="#3a2412" stroke-width="1.2"/><path d="M8 25h21" stroke="#3a2412" stroke-width="1.2"/><path d="M9 7h9" stroke="#c9a24a" stroke-width="2"/>',
  amulet:'<path d="M7 3c0 9 4 14 9 16 5-2 9-7 9-16" fill="none" stroke="#d9b14a" stroke-width="1.6" stroke-dasharray="2 1.2"/><path d="M16 17l5 5-5 7-5-7z" fill="#e0453a" stroke="#d9b14a" stroke-width="1.5"/>',
  ring:'<circle cx="16" cy="19" r="8" fill="none" stroke="#d9b14a" stroke-width="3.2"/><path d="M16 4l4 4-4 5-4-5z" fill="#5ac8ff" stroke="#2e7ca8"/>'
};
const svgIcon=k=>`<svg class="icn" viewBox="0 0 32 32">${ICON[k]}</svg>`;
function iconKey(it){if(it.slot==='charm')return 'charm_'+(CHARM[it.size]?it.size:'small');if(it.slot==='weapon')return WEAPONS[it.wt]?it.wt:'sword';if(it.slot==='body')return it.kind||'leather';if(it.slot==='focus')return it.kind||'orb';return it.slot;}
function itemIcon(it){return svgIcon(iconKey(it));}
// Same icons as images for drawing loot on the canvas; each is built once and cached.
const ICON_IMG={};
function iconImg(k){let im=ICON_IMG[k];if(!im){im=new Image();im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64">${ICON[k]}</svg>`);ICON_IMG[k]=im;}return im;}
function slotIcon(sl,cls){const arc=cls==='arcanist';return svgIcon(sl==='mainhand'?(arc?'wand':'sword'):sl==='offhand'?(arc?'orb':'shield'):sl==='body'?'plate':SLOT_TYPE[sl]);}
const tierLabel=it=>it.tier?'Tier '+TIER_NAME[it.tier-1]+(it.myth?' Mythic':''):'';
function typeLabel(it){if(it.slot==='charm')return (CHARM[it.size]||CHARM.small).name;if(it.slot==='weapon'){const w=wOf(it);return (w.hands===2?'Two-Handed ':'One-Handed ')+w.name;}if(it.slot==='focus')return (FOCUS[it.kind]||FOCUS.orb).name;if(KINDS[it.slot]&&KINDS[it.slot][it.kind])return KINDS[it.slot][it.kind].name;return it.slot==='body'&&BODY[it.kind]?BODY[it.kind].name:TYPES[it.slot].name;}
// PoE-style rarity colours: normal white, magic blue, rare yellow, unique orange-brown; Runebind teal, set green. Currency (gold, gems, runes) is CURRENCY_COL.
const RCOL=['#c8c8c8','#8888ff','#ffff77','#c8743a','#5fd0c0','#3fe05a'],CURRENCY_COL='#c8b48a';
const RNAME=['Common','Magic','Rare','Unique','Runebind','Set']; // Runebinds (4) never drop: they're forged from runes. Set items are 5.
const SKILL_REQ=[1,2,4,7,10];
const POT_MAX=10;


const CLASSES={
  warden:{name:'Warden',icon:'🪓',color:'#b8683a',res:'Fury',hp:130,hpL:16,mp:100,mpL:0,regen:3,
    desc:'Armored brawler. Cleaves, leaps and whirls through crowds. Builds Fury by hitting.'},
  arcanist:{name:'Arcanist',icon:'🔮',color:'#6b4aa8',res:'Mana',hp:95,hpL:11,mp:80,mpL:4,regen:6,
    desc:'Fragile spellcaster. Hurls fire, frost and lightning from a distance. Uses Mana.'}
};

// One resistance roll at affix level l (see the resistances in AFF).
const resRoll=l=>rand(3,6)+l*0.25+Math.max(0,l-25)*0.35;
const AFF={
  life:{ps:'p',t:'+{v} Life',pre:'Hale',suf:'of the Bear',roll:l=>rand(6,12)+l*3.5},
  res:{ps:'p',t:'+{v} Max Fury/Mana',pre:'Spirited',suf:'of the Mind',roll:l=>rand(5,10)+l*0.8},
  dmg:{ps:'p',t:'+{v}% Damage',pre:'Cruel',suf:'of Wrath',roll:l=>rand(5,11)+l*0.75},
  armor:{ps:'p',t:'+{v} Armor',pre:'Sturdy',suf:'of Iron',roll:l=>rand(4,8)+l*2.5},
  crit:{ps:'s',t:'+{v}% Crit Chance',pre:'Keen',suf:'of Precision',roll:l=>rand(2,4.5)*(1+0.035*(l-1)),dec:1},
  critd:{ps:'s',t:'+{v}% Crit Damage',pre:'Deadly',suf:'of Ruin',roll:l=>rand(10,20)+l*1.1},
  aspd:{ps:'s',t:'+{v}% Attack Speed',pre:'Swift',suf:'of Haste',roll:l=>rand(4.5,10)*(1+0.03*(l-1))},
  cdr:{ps:'s',t:'+{v}% Cooldown Reduction',pre:'Focused',suf:'of Ages',roll:l=>rand(3,7)*(1+0.025*(l-1))},
  move:{ps:'s',t:'+{v}% Move Speed',pre:'Fleet',suf:'of the Wind',roll:l=>rand(4,9)*(1+0.025*(l-1))},
  loh:{ps:'p',t:'+{v} Life on Hit',pre:'Vampiric',suf:'of Leeching',roll:l=>rand(1,3)+l*0.4},
  regen:{ps:'s',t:'+{v} Life per Second',pre:'Mending',suf:'of Renewal',roll:l=>rand(1,2)+l*0.35,dec:1},
  // flat: never multiplied (upgrades on rings and amulets)
  block:{ps:'s',t:'+{v}% Block Chance',pre:'Warding',suf:'of the Bulwark',roll:l=>rand(3,6)+Math.min(4,l*0.1),flat:1},
  spell:{ps:'p',t:'+{v}% Spell Damage',pre:'Arcane',suf:'of Sorcery',roll:l=>rand(5,10)+l*0.4,cls:'arcanist'},
  pot:{ps:'s',t:'+{v} Potion Charges',pre:"Brewer's",suf:'of Plenty',roll:l=>rand(1,1.6)+(l>=15?0.6:0),flat:1},
  // resistances (v1.0.57): they grow with item level, faster past 25, so Nightmare and Hell gear (item level 26-75+)
  // rolls enough to win back their penalty: Tier I ~4-7%, Tier V ~9-12%, Nightmare up to ~27%, Hell up to ~42%
  // (All Resistances: half). Small in Normal on purpose, so the Normal boss fights keep their tuning.
  // 'resist' is not a stat: a pool entry that rolls one of the four (so armour keeps its old stats as often as before).
  fres:{ps:'s',t:'+{v}% Fire Resistance',pre:'Tempered',suf:'of the Salamander',roll:resRoll,flat:1,res:1},
  cres:{ps:'s',t:'+{v}% Cold Resistance',pre:'Furred',suf:'of the Yeti',roll:resRoll,flat:1,res:1},
  lres:{ps:'s',t:'+{v}% Lightning Resistance',pre:'Grounded',suf:'of the Storm',roll:resRoll,flat:1,res:1},
  pres:{ps:'s',t:'+{v}% Poison Resistance',pre:'Antidotal',suf:'of the Serpent',roll:resRoll,flat:1,res:1},
  ares:{ps:'s',t:'+{v}% All Resistances',pre:'Warded',suf:'of the Elements',roll:l=>resRoll(l)*0.5,flat:1,res:1},
  resist:{ps:'s',t:'',pre:'',suf:'',roll:()=>0,flat:1,meta:1},
  // v1.0.70: skill damage (skd0-skd4: the wearer's skills in skill-bar order; 'skdmg' rolls one of them), boss damage,
  // % maximum Life, thorns, evasion, less damage taken (myth: only on Mythic bases).
  skd0:{ps:'p',t:'+{v}% damage with skill 1',pre:'Practised',suf:'of Technique',roll:l=>rand(10,16)+l*0.4,flat:1,skd:0},
  skd1:{ps:'p',t:'+{v}% damage with skill 2',pre:'Practised',suf:'of Technique',roll:l=>rand(10,16)+l*0.4,flat:1,skd:1},
  skd2:{ps:'p',t:'+{v}% damage with skill 3',pre:'Practised',suf:'of Technique',roll:l=>rand(10,16)+l*0.4,flat:1,skd:2},
  skd3:{ps:'p',t:'+{v}% damage with skill 4',pre:'Practised',suf:'of Technique',roll:l=>rand(10,16)+l*0.4,flat:1,skd:3},
  skd4:{ps:'p',t:'+{v}% damage with skill 5',pre:'Practised',suf:'of Technique',roll:l=>rand(10,16)+l*0.4,flat:1,skd:4},
  skdmg:{ps:'p',t:'',pre:'',suf:'',roll:()=>0,flat:1,meta:1},
  bossdmg:{ps:'s',t:'+{v}% damage to bosses',pre:'Regicidal',suf:'of the Slayer',roll:l=>rand(6,10)+l*0.22,flat:1},
  lifepct:{ps:'p',t:'+{v}% maximum Life',pre:'Vigorous',suf:'of Vigour',roll:l=>rand(3,5)+l*0.06,flat:1},
  thorns:{ps:'p',t:'{v} damage to attackers when hit',pre:'Barbed',suf:'of Thorns',roll:l=>rand(6,12)+l*1.8,flat:1},
  evade:{ps:'s',t:'+{v}% chance to evade hits',pre:'Elusive',suf:'of Evasion',roll:l=>rand(2,4)+l*0.04,dec:1,flat:1},
  // v1.0.83: ailment chances on any direct hit (ailments.js): Ignite, Shock, Poison. Cap AIL_CH_CAP each.
  igniteCh:{ps:'s',t:'+{v}% chance to Ignite',pre:'Smouldering',suf:'of Embers',roll:l=>rand(4,7)+l*0.14,flat:1},
  shockCh:{ps:'s',t:'+{v}% chance to Shock',pre:'Crackling',suf:'of Sparks',roll:l=>rand(4,7)+l*0.14,flat:1},
  poisonCh:{ps:'s',t:'+{v}% chance to Poison',pre:'Venomous',suf:'of the Asp',roll:l=>rand(4,7)+l*0.14,flat:1},
  dr:{ps:'s',t:'{v}% less damage taken',pre:'Unyielding',suf:'of Endurance',roll:l=>rand(1.5,3)+l*0.035,dec:1,flat:1,myth:1},
  // charm-only stats (v1.0.62, charms.js): never on gear. nom: not scaled by the charm's size; lg: large and grand only.
  rarity:{ps:'s',t:'+{v}% Item Rarity',pre:'Lucky',suf:'of Fortune',roll:l=>rand(8,13)+l*0.3,flat:1,charm:1},
  gold:{ps:'s',t:'+{v}% Gold Found',pre:'Gilded',suf:'of Greed',roll:l=>rand(14,22)+l*0.4,flat:1,charm:1},
  xp:{ps:'s',t:'+{v}% Experience',pre:'Learned',suf:'of Wisdom',roll:l=>rand(6,10)+l*0.12,flat:1,charm:1},
  lpk:{ps:'p',t:'+{v} Life per Kill',pre:'Hungry',suf:'of the Feast',roll:l=>rand(4,8)+l*1.1,flat:1,charm:1},
  potheal:{ps:'s',t:'+{v}% Potion Healing',pre:'Brimming',suf:'of the Spring',roll:l=>rand(14,22)+l*0.25,flat:1,charm:1},
  maxres:{ps:'s',t:'+{v}% to maximum Resistances',pre:'Unyielding',suf:'of the Bastion',roll:l=>l>=50?2:1,flat:1,charm:1,nom:1,lg:1},
  allsk:{ps:'p',t:'+{v} to All Skills',pre:'Exalted',suf:'of Mastery',roll:()=>1,flat:1,charm:1,nom:1,only:1} // unique charms only
};
const RES_KEYS=['fres','cres','lres','pres'],RES_CAP=75;
const resCap=s=>RES_CAP+(s&&s.maxres||0); // charms can raise it
const RES_NAME={fres:'Fire',cres:'Cold',lres:'Lightning',pres:'Poison'},RES_COL={fres:'#ff9a3a',cres:'#9fd8ff',lres:'#ffe45a',pres:'#9fe04a'};
const AFF_KEYS=Object.keys(AFF).filter(k=>!AFF[k].meta&&!AFF[k].charm); // gear (charm stats stay on charms)
// Per-tier base names (Tier I … V); amulets and rings are untiered.
const BASES={shield:[['Buckler','Round Shield'],['Kite Shield','Sandstone Targe'],['Heater','Rotwood Pavise'],['Tower Shield','Frostward Shield'],['Ember Bulwark','Demon Aegis']],
  helm:[['Cap','Hood'],['Helm','Desert Circlet'],['Great Helm','Bog Coif'],['Frost Helm','Winged Helm'],['Cinder Crown','Demon Horns']],
  gloves:[['Gloves','Wraps'],['Bracers','Sandsilk Wraps'],['Gauntlets','Bogleather Gloves'],['Frost Gauntlets','Rime Grips'],['Ember Gauntlets','Demon Claws']],
  belt:[['Sash','Leather Belt'],['Heavy Belt','Sand Sash'],['Girdle','Rotwood Cord'],['Frost Girdle','Plated Belt'],['Ember Girdle','Demon Chain']],
  boots:[['Boots','Sandals'],['Greaves','Dune Treads'],['Marsh Boots','Bog Waders'],['Frost Greaves','Ice Treads'],['Ember Greaves','Demon Hooves']],
  amulet:['Amulet','Pendant','Talisman','Choker'],ring:['Ring','Band','Signet']};
// Base kinds (v1.0.69): helms, gloves, boots, belts and shields come in three kinds, each with its own built-in
// stats (implicits) and armor, the way body armor (BODY) and foci (FOCUS) already did. arm: armor multiplier;
// imp(bl): the implicits at base level bl; bases: one name per tier. Old items get the kind their name matches.
const KINDS={
  shield:{tower:{name:'Tower Shield',arm:1.4,imp:bl=>[{k:'block',v:Math.round(rand(6,9)+Math.min(6,bl*0.2))}],bases:['Plank Shield','Bronze Tower','Rotwood Pavise','Frostward Shield','Demon Aegis']},
    kite:{name:'Kite Shield',arm:1,imp:bl=>[{k:'block',v:Math.round(rand(8,13)+Math.min(8,bl*0.25))}],bases:['Round Shield','Kite Shield','Heater','Tower Shield','Ember Bulwark']},
    buckler:{name:'Buckler',arm:0.6,imp:bl=>[{k:'block',v:Math.round(rand(11,15)+Math.min(8,bl*0.25))},{k:'aspd',v:randi(3,5)}],bases:['Buckler','Sandstone Targe','Bog Buckler','Rime Buckler','Cinder Buckler']}},
  helm:{greathelm:{name:'Greathelm',arm:1.3,imp:bl=>[{k:'life',v:Math.round(AFF.life.roll(bl)*0.5)}],bases:['Cap','Helm','Great Helm','Frost Helm','Demon Horns']},
    circlet:{name:'Circlet',arm:0.55,imp:()=>[{k:'cdr',v:randi(3,5)}],bases:['Circlet','Desert Circlet','Thorn Circlet','Winged Helm','Cinder Crown']},
    hood:{name:'Hood',arm:0.85,imp:()=>[{k:'crit',v:+rand(1.5,3).toFixed(1)}],bases:['Hood','Desert Hood','Bog Coif','Frost Hood','Ash Hood']}},
  gloves:{gauntlets:{name:'Gauntlets',arm:1.3,imp:bl=>[{k:'loh',v:Math.round(rand(1,3)+bl*0.15)}],bases:['Gloves','Bronze Gauntlets','Gauntlets','Frost Gauntlets','Ember Gauntlets']},
    wraps:{name:'Wraps',arm:0.6,imp:()=>[{k:'aspd',v:randi(3,6)}],bases:['Wraps','Sandsilk Wraps','Bogleather Gloves','Rime Grips','Ash Wraps']},
    bracers:{name:'Bracers',arm:1,imp:bl=>[{k:'critd',v:Math.round(rand(6,10)+bl*0.2)}],bases:['Bracers','Sun Bracers','Bog Bracers','Rime Bracers','Demon Claws']}},
  boots:{greaves:{name:'Greaves',arm:1.3,imp:()=>[{k:'move',v:randi(2,4)}],bases:['Boots','Greaves','Marsh Greaves','Frost Greaves','Ember Greaves']},
    striders:{name:'Striders',arm:0.65,imp:()=>[{k:'move',v:randi(6,9)}],bases:['Sandals','Dune Striders','Bog Waders','Ice Striders','Ash Striders']},
    treads:{name:'Treads',arm:1,imp:bl=>[{k:'move',v:randi(3,5)},{k:'regen',v:+(0.5+bl*0.06).toFixed(1)}],bases:['Treads','Dune Treads','Marsh Boots','Ice Treads','Demon Hooves']}},
  belt:{sash:{name:'Sash',imp:bl=>[{k:'pot',v:bl>=12&&Math.random()<0.35?2:1}],bases:['Sash','Sand Sash','Rotwood Cord','Frost Sash','Ember Sash']},
    girdle:{name:'Girdle',imp:bl=>[{k:'life',v:Math.round(AFF.life.roll(bl)*0.7)}],bases:['Girdle','Heavy Belt','Bog Girdle','Frost Girdle','Ember Girdle']},
    chainbelt:{name:'Chain Belt',imp:bl=>[{k:'armor',v:Math.round(8+bl*2)}],bases:['Leather Belt','Studded Belt','Plated Belt','Rime Chain','Demon Chain']}}
};
const KIND_DEFAULT={shield:'kite',helm:'greathelm',gloves:'bracers',boots:'treads',belt:'girdle'};
// The kind of an old item: the kind whose names include its base, else the slot's middle kind.
function kindOfBase(slot,base){const b=String(base||'').replace(/^(Superior |Mythic )+/,''),K=KINDS[slot];for(const k in K)if(K[k].bases.includes(b))return k;return KIND_DEFAULT[slot];}
// Mythic bases (v1.0.69): only from maps of Tier 5 and up (6% + 1% per tier above 5 of tiered drops). Tier V with 25%
// stronger base damage or armor and one extra Mythic implicit for its slot. Shown as "Tier V Mythic".
const MYTH_IMP={weapon:[['critd',15],['aspd',8],['dmg',12]],shield:[['block',5],['ares',8]],focus:[['spell',12],['cdr',5]],helm:[['maxres',1],['life',60]],
  body:[['maxres',1],['ares',10]],gloves:[['aspd',7],['critd',12]],boots:[['move',5],['ares',8]],belt:[['pot',1],['potheal',20]]};
let MYTH_NEXT=false; // rollDrop decides, the next genItem makes it
const RARE_A=['Grim','Dusk','Blood','Storm','Ash','Doom','Bone','Rune','Shadow','Gloom','Cinder','Wraith'];
const RARE_B={weapon:['Bite','Edge','Song','Fang','Reaver'],focus:['Eye','Whisper','Lens','Psalm'],shield:['Bulwark','Aegis','Wall','Guard'],helm:['Visage','Crown','Gaze','Brow'],body:['Ward','Shell','Hide','Carapace'],
  gloves:['Grip','Grasp','Fist','Touch'],belt:['Cord','Clasp','Lash','Binding'],boots:['Stride','Path','March','Step'],amulet:['Heart','Charm','Star','Ward'],ring:['Coil','Loop','Eye','Knot']};

let ITEM_ID=Date.now();
// Uniques roll at u%, set pieces at 0.75*u% (more slots have set pieces, so overall they end up about as rare as
// uniques); with no unique or set piece for the slot the item becomes a rare.
function rollRarity(boost){const r=Math.random()*100,u=1.5+boost*2,su=u*1.75,ra=9+boost*6,m=30+boost*5;if(r<u)return 3;if(r<su)return 5;if(r<su+ra)return 2;if(r<su+ra+m)return 1;return 0;}
const typesFor=cls=>TYPE_KEYS.filter(k=>!TYPES[k].cls||TYPES[k].cls===cls);
function pickType(cls){const ks=typesFor(cls);let r=Math.random()*ks.reduce((a,k)=>a+TYPES[k].w,0);for(const k of ks){r-=TYPES[k].w;if(r<0)return k;}return 'weapon';}
// ---------- drops ----------
// Drop slots and their % weights. 'offhand' is a shield (Warden) or an orb/tome focus (Arcanist).
const DROP_W={weapon:20,body:14,helm:10,gloves:10,boots:10,belt:10,offhand:10,ring:10,amulet:6};
const DROP_KEYS=Object.keys(DROP_W),DROP_TOT=DROP_KEYS.reduce((a,k)=>a+DROP_W[k],0);
const OTHER_CLS={warden:'arcanist',arcanist:'warden'},OFF_TYPE={warden:'shield',arcanist:'focus'};
const OWN_CLASS_CHANCE=0.8; // weapons and off-hands: 80% for your class, 20% for the other
const PITY=15;              // a slot missing from the last 15 drops is guaranteed next
const dropSlotOf=it=>it.slot==='shield'||it.slot==='focus'?'offhand':it.slot;
function pickDropSlot(){let r=Math.random()*DROP_TOT;for(const k of DROP_KEYS){r-=DROP_W[k];if(r<0)return k;}return 'weapon';}
// Item rarity of a monster/boss drop (v1.0.50, Diablo 2 / PoE style): white 50%, magic 30%, rare 10%, set 5%, unique 5%.
// boost (champions 1, super uniques and zone bosses 2, act bosses 3) moves odds from white to the better rarities.
const DROP_RAR=[50,30,10,0,0,5],DROP_UQ=5;
// Item Rarity (rar %, the Wanderer's Fortune set bonus; like Magic Find) multiplies the weights of magic, rare, set and unique
// against white: +25% makes every better rarity 25% more likely next to white. It never adds drops.
function dropRarity(boost=0,rar=0){const b=Math.max(0,boost),m=1+Math.max(0,rar)/100,w=[Math.max(5,DROP_RAR[0]-14*b),(DROP_RAR[1]+3*b)*m,(DROP_RAR[2]+6*b)*m,(DROP_UQ+2.5*b)*m,0,(DROP_RAR[5]+2.5*b)*m];
  let r=Math.random()*w.reduce((a,x)=>a+x,0);for(let i=0;i<6;i++){r-=w[i];if(r<0)return i;}return 0;}
// Bad-luck protection: after NAMED_PITY kills without a NEW set piece or unique (one no hero has found yet: sockets.js
// BOOK), the next item drop is one you haven't found, made for your class when one is left (newNamed). Duplicates
// neither reset the count nor satisfy it. Nightmare and Hell shorten it (maps.js DIFFS loot.pity: 160, 120).
const NAMED_PITY=200;
// Smart loot: this share of set/unique drops is picked from the items made for your class (its own uniques and sets);
// the rest roll normally (slot first), which mostly also gives items you can wear.
const SMART_LOOT=0.6;
// The strongest uniques (two powers, or Act V build-defining ones) drop at this weight next to 1 for the others.
const STRONG_UQ_W=0.4;
const uqWeight=k=>UNIQUES[k]&&UNIQUES[k].strong?STRONG_UQ_W:1;
function pickW(ks,wf){let r=Math.random()*ks.reduce((a,k)=>a+wf(k),0);for(const k of ks){r-=wf(k);if(r<0)return k;}return ks[ks.length-1];}
// A set piece or unique made for the character's class (falling back to classless ones), weighted by slot.
function smartNamed(c,rar,act){const slotW=t=>DROP_W[t==='shield'||t==='focus'?'offhand':t]||10;
  const cand=rar===3?Object.keys(UNIQUES).filter(k=>UNIQUES[k].boss==null&&UNIQUES[k].act<=act).map(k=>({uq:k,cls:UNIQUES[k].cls,type:UNIQUES[k].type,w:slotW(UNIQUES[k].type)*uqWeight(k)}))
    :Object.keys(SET_ITEMS).filter(k=>{const S=SETS[SET_ITEMS[k].set];return S.act<=act&&inSetZone(S);}).map(k=>({si:k,cls:SETS[SET_ITEMS[k].set].cls,type:SET_ITEMS[k].type,w:slotW(SET_ITEMS[k].type)}));
  let ok=cand.filter(o=>o.cls===c.cls);if(!ok.length)ok=cand.filter(o=>!o.cls);if(!ok.length)return null;
  return pickW(ok,o=>o.w);}
// A set piece or unique no hero has found yet that can drop here (act tiers, set zones): your class's first, then classless.
function newNamed(c,act){const slotW=t=>DROP_W[t==='shield'||t==='focus'?'offhand':t]||10;
  const cand=Object.keys(UNIQUES).filter(k=>UNIQUES[k].boss==null&&UNIQUES[k].act<=act&&!BOOK.uqs[k]).map(k=>({uq:k,cls:UNIQUES[k].cls,type:UNIQUES[k].type,w:slotW(UNIQUES[k].type)*uqWeight(k)}))
    .concat(Object.keys(SET_ITEMS).filter(k=>{const S=SETS[SET_ITEMS[k].set];return S.act<=act&&inSetZone(S)&&!BOOK.sets[k];}).map(k=>({si:k,cls:SETS[SET_ITEMS[k].set].cls,type:SET_ITEMS[k].type,w:slotW(SET_ITEMS[k].type)})));
  let ok=cand.filter(o=>o.cls===c.cls);if(!ok.length)ok=cand.filter(o=>!o.cls);return ok.length?pickW(ok,o=>o.w):null;}
let DROP_R=null; // the rarity rollDrop decided, used once by the next genItem
// Every monster/boss drop goes through here: rarity (with bad-luck protection and smart loot), then the slot with its own
// bad-luck protection, the class roll for weapons and off-hands, and the base tier. opt.act = the act whose tiers drop
// (default: from item level); opt.top = always that act's tier (bosses). Rare and better items always come in the
// current act's tier, so a rare from the current act is often an upgrade; whites and blues can come in older tiers.
function rollDrop(c,ilvl,boost=0,minRarity=0,opt={}){
  const ds=c.dropSince||(c.dropSince={});for(const k of DROP_KEYS)if(typeof ds[k]!=='number')ds[k]=0;
  const tier0=opt.act||tierOfLvl(ilvl);
  {const r=G.char===c&&typeof inMap==='function'&&inMap()?c.mapRun:null;MYTH_NEXT=!!(r&&r.sig.tier>=5&&Math.random()<0.06+0.01*(r.sig.tier-5));} // Mythic bases from maps of Tier 5+
  const L=lootHere(),due=(c.namedSince||0)>=Math.min(NAMED_PITY,L.pity);const rp=(G.char===c&&G.stats?G.stats.rarity||0:0)+L.rar; /* maps.js: Nightmare and Hell loot */let rar=dropRarity(boost,rp);if(due&&rar!==3&&rar!==5)rar=Math.random()<0.5?3:5;
  if(minRarity>=3&&rar!==3)rar=3;else if(rar<minRarity)rar=minRarity;
  // map uniques (uniques.js boss 'map'): in maps of their Sigil tier, a third of unique drops is one
  if(rar===3&&!minRarity&&G.char===c&&typeof inMap==='function'&&inMap()&&Math.random()<0.35){const T=c.mapRun.sig.tier,ks=Object.keys(UNIQUES).filter(k=>UNIQUES[k].boss==='map'&&UNIQUES[k].mt<=T&&(!UNIQUES[k].cls||UNIQUES[k].cls===c.cls));
    if(ks.length){const k=pickW(ks,uqWeight),U=UNIQUES[k];return genItem(ilvl,c.cls,boost,U.type,3,U.wt,5,null,k);}}
  // Each slot must appear within its next (PITY+1-misses) drops. Sorted by that deadline, if the j-th slot's deadline is <= j
  // there is no slack left, so the most urgent slot drops now. This forces a slot at 15 misses, and also steps in a little
  // early when several slots run out together, so no slot ever goes more than PITY drops without appearing.
  const dl=DROP_KEYS.map(k=>[PITY+1-ds[k],k]).sort((a,b)=>a[0]-b[0]);
  let slot=null;for(let j=0;j<dl.length;j++)if(dl[j][0]<=j+1){slot=dl[0][1];break;}
  const forced=!!slot;
  if(due){const o=newNamed(c,tier0);if(o){const sl=dropSlotOf({slot:o.type});for(const k of DROP_KEYS)ds[k]=k===sl?0:ds[k]+1; // the guarantee: something new
    return genItem(ilvl,o.cls||c.cls,boost,o.type,0,undefined,TIERED.has(o.type)?tier0:undefined,o.si,o.uq);}
    c.namedSince=0;} // nothing new left here: an ordinary set piece or unique, and the count starts over
  if(!forced&&(rar===3||rar===5)&&Math.random()<SMART_LOOT){const o=smartNamed(c,rar,tier0);
    if(o){const sl=dropSlotOf({slot:o.type});for(const k of DROP_KEYS)ds[k]=k===sl?0:ds[k]+1;
      const icls=o.cls||c.cls;return genItem(ilvl,icls,boost,o.type,0,undefined,TIERED.has(o.type)?tier0:undefined,o.si,o.uq);}}
  if(!slot)slot=pickDropSlot();
  let icls=c.cls;if(slot==='weapon'||slot==='offhand')icls=Math.random()<OWN_CLASS_CHANCE?c.cls:OTHER_CLS[c.cls];
  let type=slot==='offhand'?OFF_TYPE[icls]:slot;
  let tier=TIERED.has(type)?(rar>=2?tier0:rollTier(tier0,opt.top,rp)):undefined;
  // a set piece or unique needs a slot that has one: otherwise re-pick among those that do, by drop weight
  const has=(ty,ic,t)=>rar===3?uniquesFor(ty,ic,t).length:setItemsFor(ty,ic,t).length;
  // a forced slot (slot pity) tries the other kind first; only the set/unique guarantee may override the slot pity
  if((rar===3||rar===5)&&forced&&minRarity<3&&!has(type,icls,tier||tier0)){const alt=rar===3?5:3,r0=rar;rar=alt;if(!has(type,icls,tier||tier0))rar=r0;}
  if((rar===3||rar===5)&&!has(type,icls,tier||tier0)&&(!forced||due||minRarity>=3)){
    const ok=[];for(const k of DROP_KEYS){const cs=k==='weapon'||k==='offhand'?[[c.cls,OWN_CLASS_CHANCE],[OTHER_CLS[c.cls],1-OWN_CLASS_CHANCE]]:[[c.cls,1]];
      for(const [ic,w] of cs){const ty=k==='offhand'?OFF_TYPE[ic]:k;if(has(ty,ic,tier0))ok.push([k,ic,ty,DROP_W[k]*w]);}}
    if(ok.length){let r=Math.random()*ok.reduce((a,o)=>a+o[3],0);let o=ok[ok.length-1];for(const x of ok){r-=x[3];if(r<0){o=x;break;}}
      [slot,icls,type]=o;tier=TIERED.has(type)?tier0:undefined;}
  }
  for(const k of DROP_KEYS)ds[k]=k===slot?0:ds[k]+1;
  DROP_R=rar;try{return genItem(ilvl,icls,boost,type,0,undefined,tier);}finally{DROP_R=null;}
}
// T (magic, rare and charm stats): {il: item level, boost, best, worst} rolls a tier (see affix tiers); without T the old
// way (uniques, set items, implicits).
function rollAff(k,ilvl,rm=1,T){if(k==='resist')k=pick(RES_KEYS);if(k==='skdmg')k='skd'+randi(0,4);const a=AFF[k];
  if(T&&tiered(k)){const t=rollAffTier(T.il,T.boost||0,T);return {k,v:tierVal(k,ilvl,t,rm),t};}
  const v=a.roll(ilvl)*rm;return {k,v:a.dec?+v.toFixed(1):Math.max(1,Math.round(v))};}
// tier: base tier 1..5 for tiered types (default: the tier of the item level's act). forceSet: make this set piece.
// forceUq: make this unique (boss trophies, which never come from the normal unique pool).
function genItem(ilvl,cls,boost=0,forceType,minRarity=0,forceWt,tier,forceSet,forceUq){
  if(forceSet){forceType=SET_ITEMS[forceSet].type;forceWt=SET_ITEMS[forceSet].wt;}
  if(forceUq){forceType=UNIQUES[forceUq].type;forceWt=UNIQUES[forceUq].wt;}
  const slot=forceType||pickType(cls); // item.slot holds the item TYPE (weapon, shield, body, ring…)
  const rr=DROP_R??rollRarity(boost);DROP_R=null;let rarity=forceSet?5:rr===5?(minRarity>=3?3:5):Math.max(minRarity,rr); // a guaranteed unique stays a unique
  // uniques are fixed named items (see uniques.js); with none for this type, class and act the item becomes a rare
  const uact=clamp(Math.round(tier||tierOfLvl(ilvl)),1,5);let U=null;
  if(forceUq){rarity=3;U=forceUq;}
  else if(rarity===3){const ks=uniquesFor(slot,cls,uact).filter(k=>!forceWt||UNIQUES[k].wt===forceWt);if(ks.length){U=pickW(ks,uqWeight);forceWt=UNIQUES[U].wt||forceWt;}else rarity=2;}
  // set pieces: one that can drop for this type, class and act (and zone), or a rare when there is none
  let SI=forceSet||null;if(rarity===5&&!SI){const ks=setItemsFor(slot,cls,uact).filter(k=>!forceWt||SET_ITEMS[k].wt===forceWt);if(ks.length){SI=pick(ks);forceWt=SET_ITEMS[SI].wt||forceWt;}else rarity=2;}
  const FX=U?UNIQUES[U]:SI?SET_ITEMS[SI]:null; // fixed kind (body/focus) for named items
  const it={id:++ITEM_ID,slot,rarity,ilvl,cls,upg:0,affs:[]};if(U)it.uq=U;if(SI)it.si=SI;
  const rm=rarity===3?1.3:rarity===5?1.2:1;
  let bl=ilvl;
  if(TIERED.has(slot)){
    if(slot==='weapon')it.wt=forceWt||pick(Object.keys(WEAPONS).filter(k=>WEAPONS[k].cls===cls&&WEAPONS[k].act<=(tier||tierOfLvl(ilvl))));
    // a weapon type can't come in a tier older than the act that introduces it
    const t=clamp(Math.round(tier||tierOfLvl(ilvl)),slot==='weapon'?WEAPONS[it.wt].act:1,5);
    it.tier=t;bl=baseLvl(t,ilvl);
  }
  if(slot==='weapon'){const W=WEAPONS[it.wt];it.base=W.bases[it.tier-W.act];const b=(5+bl*2.4)*W.dmg*rand(0.85,1.15)*(rarity===2?1.1:rarity===3?1.25:rarity===5?1.2:1);it.dmin=b*0.8;it.dmax=b*1.2;
    if(W.skill)it.imp=[{k:'skill',s:randi(0,4),v:W.skill}];}
  else if(slot==='focus'){it.kind=FX&&FX.kind||pick(Object.keys(FOCUS));it.base=pick(FOCUS[it.kind].bases[it.tier-1]);
    it.imp=it.kind==='orb'?[{k:'spell',v:Math.round(rand(10,16)+Math.min(10,bl*0.3))}]:[{k:'cdr',v:randi(4,7)},rollAff('res',bl)];}
  else if(slot==='body'){it.kind=FX&&FX.kind||pick(Object.keys(BODY));const K=BODY[it.kind];it.base=pick(K.bases[it.tier-1]);it.arm=(6+bl*3)*K.arm*rand(0.9,1.1);if(K.imp)it.imp=[rollAff(K.imp,bl)];}
  else if(KINDS[slot]){it.kind=FX&&FX.kind&&KINDS[slot][FX.kind]?FX.kind:pick(Object.keys(KINDS[slot]));const K=KINDS[slot][it.kind];it.base=K.bases[it.tier-1];it.imp=K.imp(bl);} // base kinds: their own implicits
  else it.base=pick(it.tier?BASES[slot][it.tier-1]:BASES[slot]);
  if(ARM[slot])it.arm=(ARM[slot][0]+bl*ARM[slot][1])*rand(0.9,1.1)*(KINDS[slot]&&it.kind?KINDS[slot][it.kind].arm||1:1);
  // Mythic (maps of Tier 5+): stronger base, one more implicit
  if(MYTH_NEXT&&TIERED.has(slot)&&!U&&!SI&&it.tier===5){it.myth=true;if(it.dmin){it.dmin*=1.25;it.dmax*=1.25;}if(it.arm)it.arm*=1.25;const [k,v]=pick(MYTH_IMP[slot]);it.imp=(it.imp||[]).concat([{k,v,myth:1}]);}
  MYTH_NEXT=false;
  let n=[0,randi(1,2),randi(3,4),4][rarity];if(slot==='ring'||slot==='amulet')n=Math.max(1,n);
  const pool=(TYPES[slot].pool||AFF_KEYS).filter(k=>(!AFF[k].cls||AFF[k].cls===cls)&&(!AFF[k].myth||it.myth)); // myth stats: Mythic bases only
  const keys=SI?SET_ITEMS[SI].affs.slice():U?pool.slice().sort(()=>Math.random()-0.5).slice(0,n):pickAffKeys(pool,n,rarity<=1?1:MAX_PRE,rarity<=1?1:MAX_SUF); // magic 1+1, rare 2+2
  const TT=!U&&!SI?{il:ilvl,boost,mt:mapTilt()}:null; // tiers on magic and rare items only
  for(const k of keys)it.affs.push(rollAff(k,affLvl(ilvl,it.tier),rm,TT));it.uv=UPG_VER;
  if((rarity===2&&Math.random()<0.3)||rarity===3)it.affs.push({k:'skill',s:randi(0,4),v:rarity===3?randi(1,2):1});
  if(U)it.name=UNIQUES[U].name;
  else if(SI)it.name=SET_ITEMS[SI].name;
  else if(rarity===2)it.name=pick(RARE_A)+' '+pick(RARE_B[slot]);
  else if(rarity===1){const a0=it.affs[0]&&AFF[it.affs[0].k],a1=it.affs[1]&&AFF[it.affs[1].k];it.name=(a0?a0.pre+' ':'')+it.base+(a1?' '+a1.suf:'');}
  else it.name=it.base;
  const ns=rollSockets(it);if(ns)it.sockets=ns;
  return it;
}
function affVal(a,m){const d=AFF[a.k];let v=a.v*(d&&d.flat?1:m);return d&&d.dec?v.toFixed(1):Math.round(v);}
// Affixes follow the tier: a tiered item rolls its affixes at an "affix level" inside its tier's act (Tier III: item
// levels 11-15), so an older tier dropped late still rolls older, smaller numbers (Tier V Life ~4x Tier I, Damage % and
// Crit Damage ~2-2.5x, Crit, Attack/Move Speed and Cooldown ~1.5-1.8x). Tier V keeps climbing in the endless depths.
const affLvl=(ilvl,tier)=>!tier?ilvl:clamp(ilvl,TIER_LO[tier-1],tier===5?999:TIER_LO[tier-1]+4);
// ---------- affix tiers (v1.0.60, PoE2 style) ----------
// Every random stat on a magic or rare item (and on charms) rolls a tier, T1 best ... T9 worst. The tier says how good the
// roll is; the size of the numbers still comes from the affix level (affLvl above), so a T1 Hell helm beats a T1 Normal
// one. Each tier is a band around the stat's middle value at that level (TIER_BAND, times the middle). Weights (TIER_W):
// T5-T7 common, T1-T2 rare, set so an average drop is as strong as before tiers. Better tiers need item level
// (TIER_MIN_IL: T1 20+, T2 15+ ...). Harder content raises the floor (tierFloor): item level 26+ (Nightmare, Endless after
// Normal) T1-T6, 51+ (Hell, Endless after Nightmare) T1-T5, 76+ (Endless after Hell) T1-T3. Item level and the monster's
// boost (champions, bosses) shift the odds toward better tiers. Uniques, set items, Runebinds and implicits: no tiers.
// Stats are prefixes or suffixes (AFF[k].ps); rares hold up to MAX_PRE + MAX_SUF of them, magic items 1 + 1.
const TIER_N=9,MAX_PRE=2,MAX_SUF=2;
const TIER_BAND0=[null,[1.95,2.25],[1.65,1.95],[1.4,1.65],[1.2,1.4],[1.04,1.2],[0.92,1.04],[0.82,0.92],[0.73,0.82],[0.62,0.73]];
let TIER_BAND=TIER_BAND0; // scaled below (after tierWeights) so an average Normal drop (item level 15) is as strong as before tiers
const TIER_W=[0,0.8,2,5.5,11,17,20,18,13,9],TIER_MIN_IL=[0,18,12,7,3,1,1,1,1,1];
const tierFloor=il=>il>75?3:il>50?5:il>25?6:TIER_N;
const NO_TIER=new Set(['pot','maxres','allsk']);
const tiered=k=>!!AFF[k]&&!AFF[k].meta&&!NO_TIER.has(k);
// T.best / T.worst (catalysts, v1.0.62) narrow the range further.
// T.mt (maps, v1.0.78): the map's Item Rarity tilts the odds toward the best tiers: each tier above T3 weighs (1+mt)x
// more per step (mapTilt: 0 with no modifiers, up to 1.5).
function tierWeights(il,boost=0,T={}){const lo=Math.min(tierFloor(il),T.worst||TIER_N),hi=T.best||1,s=clamp((il-1)/75,0,1),b=Math.max(0,boost),mt=Math.max(0,T.mt||0);
  return TIER_W.map((w,t)=>t<hi||t>lo||il<TIER_MIN_IL[t]&&t<lo?0:w*(1+(1.6*s+0.3*b)*(TIER_N-t)/(TIER_N-1))*(mt&&t<3?Math.pow(1+mt,3-t):1));}
const MAP_TILT_MAX=1.5,tiltOf=rar=>clamp((rar||0)/70,0,MAP_TILT_MAX);
// The open map's tilt (sigils.js runQR: its modifiers, node, Atlas tree and Engraving rarity).
function mapTilt(){const c=G.char;return c&&c.mapRun&&typeof inMap==='function'&&inMap()?tiltOf(runQR(c,c.mapRun).r):0;}
// "T1 x% · T2 y% · T3 z%" for map drops (item level 76+) at a given Item Rarity from the map.
function tierOddsText(rar){const w=tierWeights(80,0,{mt:tiltOf(rar)}),tot=w.reduce((a,x)=>a+x,0);return [1,2,3].map(t=>`T${t} ${Math.round(100*w[t]/tot)}%`).join(' · ');}
{const w=tierWeights(15),tot=w.reduce((a,b)=>a+b,0);let m=0;for(let t=1;t<=TIER_N;t++)m+=w[t]/tot*(TIER_BAND0[t][0]+TIER_BAND0[t][1])/2;TIER_BAND=TIER_BAND0.map(B=>B&&B.map(x=>x/m));}
function rollAffTier(il,boost,T){const w=tierWeights(il,boost,T);let r=Math.random()*w.reduce((a,x)=>a+x,0);for(let t=1;t<=TIER_N;t++){r-=w[t];if(r<0)return t;}return tierFloor(il);}
const affMid=(k,l)=>{const [a,b]=rollRange(k,l);return (a+b)/2;};
const fmtAff=(k,v)=>AFF[k].dec?+v.toFixed(1):Math.max(1,Math.round(v));
// A value for stat k at affix level l in tier t (rm: rarity or charm multiplier).
const tierVal=(k,l,t,rm=1)=>fmtAff(k,affMid(k,l)*rand(TIER_BAND[t][0],TIER_BAND[t][1])*rm);
// The tier an existing value fits (old items, v1.0.60): the band that holds it, or the nearest end.
function tierOf(k,l,v,rm=1){const m=affMid(k,l)*rm;if(!(m>0))return 5;const q=v/m;for(let t=1;t<=TIER_N;t++)if(q>=TIER_BAND[t][0]-1e-9)return t;return TIER_N;}
const isPre=k=>AFF[k]&&AFF[k].ps==='p';
const preCount=it=>it.affs.filter(a=>a.k!=='skill'&&isPre(a.k)).length,sufCount=it=>it.affs.filter(a=>a.k!=='skill'&&AFF[a.k]&&!isPre(a.k)).length;
// Can stat k still go on the item (an open prefix or suffix slot; magic items 1 + 1)?
function affFits(it,k,rarity=it.rarity){const mp=rarity<=1?1:MAX_PRE,ms=rarity<=1?1:MAX_SUF;return isPre(k)?preCount(it)<mp:sufCount(it)<ms;}
// n stats from a pool, at most p prefixes and q suffixes ('resist' counts as a suffix).
function pickAffKeys(pool,n,p,q){const out=[];let np=0,ns=0;for(const k of pool.slice().sort(()=>Math.random()-0.5)){if(out.length>=n)break;
  if(isPre(k)){if(np<p){out.push(k);np++;}}else if(ns<q){out.push(k);ns++;}}return out;}
// Upgrades (+1..+10, gold): +2% base damage, armor and implicit stats per level (+20% at +10); affixes are not upgraded,
// so a fresh rare from the next act beats a +10 rare from the act before (~13-21% more power; the game test checks it).
// It was +4% until v1.0.52, and +10 gear then out-powered next-act drops. Rings and amulets have no base and no tier:
// upgrades give their affixes +4% per level instead. Items from before v1.0.48 (upgrades were +10% to everything, and
// v1.0.47 gave affixes +4% per tier) are reset to the current rules when they load (bakeUpgrades, v1.0.49).
const UPG_STEP=0.02,JEWEL_STEP=0.04,UPG_VER=3;
const upgStep=it=>it.tier?UPG_STEP:JEWEL_STEP;
const upgMul=it=>1+upgStep(it)*(it.upg||0);
const affMul=it=>it.tier?1:upgMul(it);
// v1.0.49: every item is brought to the current rules, as if it had dropped today; its +level stays (now +4%/level).
// Each affix keeps its place in its range: a roll at the top of the old range lands at the top of the new one for
// the item's tier. Items from v1.0.48 (uv 2) either rolled under the new rules already (kept as they are) or had the
// old upgrade strength baked in (taken back out first). Old saves are backed up by the save version change.
const OLD_ROLL={dmg:l=>[6+l*0.6,14+l*0.6],crit:l=>[2+l*0.08,5+l*0.08],critd:l=>[12+l*0.8,25+l*0.8],aspd:()=>[5,12],cdr:()=>[3,8],move:()=>[4,10]};
function rollRange(k,l){const R=Math.random;try{Math.random=()=>0;const a=AFF[k].roll(l);Math.random=()=>1;const b=AFF[k].roll(l);return [Math.min(a,b),Math.max(a,b)];}finally{Math.random=R;}}
const affRm=(it,k)=>{const R=it.rb&&typeof RUNEBINDS!=='undefined'&&RUNEBINDS[it.rb];const b=R&&R.bonus.find(x=>x[0]===k);return b?b[1]:it.rarity===3?1.3:it.rarity===5?1.2:1;};
const scaledAff=a=>a.k!=='skill'&&AFF[a.k]&&!AFF[a.k].flat;
// v1.0.48 items: does the base look like it carries a baked upgrade? (base above what its tier can roll)
function baseInflated(it){if(!(it.upg>0)||!it.tier)return false;const bl=baseLvl(it.tier,it.ilvl),sup=it.sup?1.15:1;
  if(it.slot==='weapon'&&WEAPONS[it.wt]){const exp=(5+bl*2.4)*WEAPONS[it.wt].dmg*([1,1,1.1,1.25,1,1.2][it.rarity]||1)*sup;return (it.dmin+it.dmax)/2/exp>1.18;}
  const km=KINDS[it.slot]&&KINDS[it.slot][it.kind]?KINDS[it.slot][it.kind].arm||1:1,my=it.myth?1.25:1; /* base kinds and Mythic bases have more armor on purpose */
  const A=it.slot==='body'&&BODY[it.kind]?(6+bl*3)*BODY[it.kind].arm:ARM[it.slot]?(ARM[it.slot][0]+bl*ARM[it.slot][1])*km:0;return !!(A&&it.arm)&&it.arm/(A*sup*my)>1.13;}
function bakeUpgrades(it){if(it.slot==='charm'||it.uv>=UPG_VER){if(it.slot!=='charm')it.uv=UPG_VER;return it;} /* charms are never upgraded */
  const al=affLvl(it.ilvl,it.tier);
  if(it.uv===2){const fits=a=>{const [lo,hi]=rollRange(a.k,al),m=affRm(it,a.k);return a.v>=lo*m-1.01&&a.v<=hi*m+1.01;};
    if(it.affs.filter(scaledAff).every(fits)&&!baseInflated(it)){it.uv=UPG_VER;return it;} // rolled under the new rules
    const u=it.upg||0,old=1+0.1*u,nu=1+0.04*u,tb=it.tier>1?1+0.04*(it.tier-1):1,kb=old/nu,ka=it.tier?old*tb:old/nu; // undo v1.0.48's bake
    if(u>0){if(it.dmin!=null){it.dmin/=kb;it.dmax/=kb;}if(it.arm)it.arm/=kb;for(const a of it.imp||[])if(scaledAff(a))a.v/=kb;}
    for(const a of it.affs)if(scaledAff(a))a.v/=ka;}
  for(const a of it.affs){if(!scaledAff(a))continue;const m=affRm(it,a.k),[o0,o1]=OLD_ROLL[a.k]?OLD_ROLL[a.k](it.ilvl):rollRange(a.k,it.ilvl),[n0,n1]=rollRange(a.k,al);
    const f=clamp((a.v/m-o0)/((o1-o0)||1),0,1),v=(n0+f*(n1-n0))*m;a.v=AFF[a.k].dec?+v.toFixed(1):Math.max(1,Math.round(v));}
  for(const a of it.imp||[])if(scaledAff(a))a.v=AFF[a.k].dec?+(+a.v).toFixed(1):Math.max(1,Math.round(a.v));
  if(it.dmin!=null){it.dmin=+it.dmin.toFixed(3);it.dmax=+it.dmax.toFixed(3);}if(it.arm)it.arm=+it.arm.toFixed(3);
  it.uv=UPG_VER;return it;}
function affText(a,m,cls){if(a.k==='skill')return `+${a.v} to ${SKILLS[cls][a.s].name}`;if(AFF[a.k]&&AFF[a.k].skd!=null)return `+${affVal(a,m)}% ${SKILLS[cls][AFF[a.k].skd].name} damage`;return AFF[a.k].t.replace('{v}',affVal(a,m));}
// The tier tag after a stat line on item cards: T1-T2 gold, T3 bright, the rest dim.
const TIER_COL=[null,'#ffb347','#f2d04a','#e8dcc4','#b8a888','#a09070','#8c7c64','#7c6c58','#6c5c4c','#5c4e42'];
const tierTag=a=>a&&a.t?` <span class="atier" style="color:${TIER_COL[a.t]}">(T${a.t})</span>`:'';

// ---------- save migration (v1: weapon/helm/armor/ring → v2: 10 slots) ----------
const SAVE_VER=11; // 11: skill modifiers (c.mods, none picked on old heroes) · 10: affix tiers (each old stat gets the tier its value fits) · 9: 9: difficulties (c.diff, c.diffDone, c.dsave) and the endless reach apart (c.endMax) · 8: items reset to the v1.0.48 affix and upgrade rules (each old save is kept as a backup)
const OLD_BODY_KIND={'Robe':'robe','Leather Vest':'leather','Chain Mail':'chain','Scale Coat':'chain','Plate Armor':'plate'};
function migrateItem(it){
  if(!it||typeof it!=='object')return null;
  if(it.slot==='armor')it.slot='body';
  if(!TYPES[it.slot]&&!(it.slot==='charm'&&CHARM[it.size]))return null;
  if(it.slot==='body'&&!BODY[it.kind]){const b=String(it.base||'');it.kind=OLD_BODY_KIND[b]||(/robe|vestment/i.test(b)?'robe':/plate/i.test(b)?'plate':/chain|scale|mail/i.test(b)?'chain':'leather');}
  it.affs=(Array.isArray(it.affs)?it.affs:[]).filter(a=>a&&(a.k==='skill'||AFF[a.k]));
  if(it.imp&&!Array.isArray(it.imp))delete it.imp;
  if(it.slot==='weapon'&&!WEAPONS[it.wt])it.wt=BASE_WT[it.base]||(it.cls==='arcanist'?'staff':'sword');
  if(it.slot==='focus'&&!FOCUS[it.kind])it.kind='orb';
  if(KINDS[it.slot]&&!KINDS[it.slot][it.kind])it.kind=kindOfBase(it.slot,it.base); // v1.0.69: base kinds (implicits kept as they were)
  if(it.myth!==true)delete it.myth;if(it.corrupt!==true)delete it.corrupt;if(it.cpw&&!(typeof UPOW!=='undefined'&&UPOW[it.cpw]))delete it.cpw;
  if(it.rarity===3&&!it.uq){const k=Object.keys(UNIQUES).find(k=>UNIQUES[k].name===it.name&&UNIQUES[k].type===it.slot&&(!UNIQUES[k].wt||UNIQUES[k].wt===it.wt));if(k)it.uq=k;}
  if(it.uq&&!UNIQUES[it.uq])delete it.uq;
  if(it.rarity===5&&!SET_ITEMS[it.si])it.rarity=2; // a set piece this version doesn't know stays as a rare
  if(it.si&&it.rarity!==5)delete it.si;
  if(!(it.rarity>=0&&it.rarity<RNAME.length))it.rarity=it.affs.length?2:0;
  if(it.lock!==true)delete it.lock;
  if(it.crafts!=null&&!(it.crafts>=0))delete it.crafts; // stat crafts used (smith.js)
  if(it.q!=null){it.q=clamp(Math.round(+it.q)||0,0,20);if(!it.q)delete it.q;} // quality (currency.js)
  if(it.cat!=null&&!(typeof CURS!=='undefined'&&CURS[it.cat]&&CURS[it.cat].cat))delete it.cat; // a catalyst waiting on the item
  if(it.addOpts){it.addOpts=(Array.isArray(it.addOpts)?it.addOpts:[]).filter(a=>a&&AFF[a.k]&&Number.isFinite(a.v)).slice(0,3);if(!it.addOpts.length)delete it.addOpts;}
  if(it.sockets!=null){it.sockets=clamp(Math.floor(+it.sockets)||0,0,4);if(!it.sockets)delete it.sockets;}
  if(it.socketed){it.socketed=(Array.isArray(it.socketed)?it.socketed:[]).filter(s=>s&&(s.r?RUNES[s.r]:GEMS[s.g]&&s.q>=1&&s.q<=5)).slice(0,it.sockets||0);if(!it.socketed.length)delete it.socketed;}
  if(it.rb&&!RUNEBINDS[it.rb]){delete it.rb;if(it.rarity===4)it.rarity=0;}
  if(TIERED.has(it.slot)&&!(it.tier>=1&&it.tier<=5))it.tier=tierOfLvl(it.ilvl); // pre-tier items: their stats already match the tier of their item level
  bakeUpgrades(it); /* brought to the current affix and upgrade rules */
  // v1.0.60: stats on magic and rare items and charms get the tier their value fits (the value itself is kept)
  if(it.rarity===1||it.rarity===2||it.slot==='charm'&&!it.uc){const l=it.slot==='charm'?it.ilvl:affLvl(it.ilvl,it.tier),rmOf=k=>it.slot==='charm'?CHARM[it.size].m:affRm(it,k);
    for(const a of it.affs)if(a.t==null&&tiered(a.k))a.t=tierOf(a.k,l,a.v,rmOf(a.k));}
  for(const a of it.affs)if(a.t!=null&&!(a.t>=1&&a.t<=TIER_N&&tiered(a.k)))delete a.t;
  return it;
}
function migrateChar(c){
  if(!c||typeof c!=='object')return c;
  const old=c.equip||{},eq={};for(const s of EQ_SLOTS)eq[s]=null;
  c.bag=(Array.isArray(c.bag)?c.bag:[]).map(migrateItem).filter(Boolean);
  // Items that no longer fit (e.g. an Arcanist's shield, or an off-hand under a two-hander) go to the bag.
  const place=(it,want)=>{it=migrateItem(it);if(!it)return;const fits=fitsFor(c,it).filter(s=>!eq[s]&&slotOpen(eq,s));
    const sl=want&&fits.includes(want)?want:fits[0];if(sl)eq[sl]=it;else c.bag.push(it);};
  for(const s of EQ_SLOTS)if(old[s])place(old[s],s);           // already-new keys (idempotent)
  for(const k of ['weapon','armor','ring'])if(old[k])place(old[k]); // v1 keys
  // a second copy of a worn unique or Runebind (saved before the one-of-each rule) goes to the bag
  const seen=new Set();for(const s of EQ_SLOTS){const it=eq[s];if(!it)continue;const id=it.uq?'u:'+it.uq:it.rb?'r:'+it.rb:null;
    if(!id)continue;if(seen.has(id)){eq[s]=null;c.bag.push(it);}else seen.add(id);}
  if(c.won==null)c.won=(c.maxDepth||1)>25; // anyone already past depth 25 has beaten the Cinder King
  // v9: difficulties. Old heroes are in Normal; a won game has Nightmare open. The endless reach moves to c.endMax.
  if(c.diff==null){c.diff=0;c.diffDone=c.won?1:0;c.dsave={};if((c.maxDepth||1)>25){c.endMax=c.maxDepth;c.maxDepth=25;}}
  if(c.actSeen==null){const d=c.depth||1;c.actSeen=stageOf(d)===1?d-1:d-stageOf(d)+1;} // depth N is already Act ceil(N/5); only show titles for acts not yet entered
  migrateCharms(c);matsOf(c); // crafting materials
  fixMods(c); // v11: skill modifiers (skillmods.js)
  c.equip=eq;c.ver=SAVE_VER;return c;
}
function migrateSaves(){
  const old=SAVES.find(c=>c&&c.ver!==SAVE_VER);
  if(old){const k=SAVE_KEY+'_backup'+(old.ver?'_v'+old.ver:'');try{if(!localStorage.getItem(k))localStorage.setItem(k,localStorage.getItem(SAVE_KEY)||'[]');}catch(e){}}
  SAVES=SAVES.filter(c=>c&&typeof c==='object').map(c=>{try{return migrateChar(c);}catch(e){return c;}});
  storeSaves();
}
// migrateSaves() runs at boot in main.js, once every script (acts, skills, …) has loaded.

// ---------- stats ----------
// Where an item would go if equipped: its only slot, an empty ring slot, or the ring slot that gains the most.
// One of each: never two of the same unique, never two of the same Runebind (a unique and a Runebind with the same
// power may be worn together). pwClash: the slot of a worn twin of `it`, ignoring the slots in `skip`; clashFree: `it`
// may go in `sl` (replacing what is there, and the off hand a two-hander frees). So a second Coal Heart can only replace the first.
const sameKind=(a,b)=>!!(a.uq&&a.uq===b.uq||a.rb&&a.rb===b.rb);
function pwClash(c,it,skip=[]){if(!it.uq&&!it.rb)return null;
  for(const s of EQ_SLOTS){const o=c.equip[s];if(!o||o===it||skip.includes(s))continue;if(sameKind(o,it))return s;}return null;}
const clashFree=(c,it,sl)=>!pwClash(c,it,[sl,sl==='mainhand'&&is2h(it)?'offhand':null]);
function bestSlot(c,it){const fits=fitsFor(c,it).filter(s=>(is2h(it)||slotOpen(c.equip,s))&&clashFree(c,it,s));if(fits.length<=1)return fits[0]||null;
  const empty=fits.find(s=>!c.equip[s]);if(empty)return empty;
  let best=fits[0],bp=-1;for(const s of fits){const p=power(calcStats(c,it,s));if(p>bp){bp=p;best=s;}}return best;}
function calcStats(c,swap,at){
  const C=CLASSES[c.cls],L=c.lvl;
  const s={life:C.hp+C.hpL*(L-1),res:C.mp+C.mpL*(L-1),dmg:0,armor:0,crit:5,critd:50,aspd:0,cdr:0,move:0,loh:0,regen:0.5+L*0.1,block:0,pot:c.potUp||0,spell:0,bleed:0,poisonCh:0,shockCh:0,igniteCh:0,stunCh:0,stunDur:0,pw:{},gold:0,rarity:0,skd0:0,skd1:0,skd2:0,skd3:0,skd4:0,bossdmg:0,lifepct:0,thorns:0,evade:0,dr:0,xp:0,lpk:0,potheal:0,maxres:0,fres:0,cres:0,lres:0,pres:0,ares:0,splash:0,pierce:0,explode:0,dmin:3,dmax:5,wspd:1,mh:null,oh:null,skill:[0,0,0,0,0]};
  if(swap&&at===undefined)at=bestSlot(c,swap);
  const eq=Object.assign({},c.equip);if(swap&&at)eq[at]=swap;if(is2h(eq.mainhand))eq.offhand=null;
  for(const sl of EQ_SLOTS){
    const it=eq[sl];if(!it)continue;
    const m=upgMul(it),qm=1+(it.q||0)/100; // quality (currency.js Whetstone): base damage and armor
    if(it.slot==='weapon'){const w=wOf(it);const hand={wt:it.wt,dmin:it.dmin*m*qm,dmax:it.dmax*m*qm,spd:w.spd};if(sl==='mainhand')s.mh=hand;else s.oh=hand;
      s.crit+=w.crit||0;s.critd+=w.critd||0;s.block+=w.block||0;s.bleed+=w.bleed||0;s.poisonCh+=w.poison||0;s.spell+=w.spell||0;if(w.stun){s.stunCh+=w.stun;s.stunDur=Math.max(s.stunDur,w.stunDur);}
      s.splash+=w.splash||0;s.pierce=Math.max(s.pierce,w.pierce||0);s.explode=Math.max(s.explode,w.explode||0);}
    for(const k of itemPowers(it))s.pw[k]=true;
    if(it.arm)s.armor+=it.arm*m*qm;
    if(it.socketed){const h=hostOf(it);for(const sg of it.socketed){const a=stoneStat(sg,h);s[a.k]+=a.v;}} // gems and runes: flat, not upgraded
    const am=affMul(it); /* affixes: upgrades and the tier bonus; implicits: upgrades only */
    for(const a of it.affs){if(a.k==='skill')s.skill[a.s]+=a.v;else s[a.k]+=a.v*(AFF[a.k].flat?1:am);}
    for(const a of it.imp||[]){if(a.k==='skill')s.skill[a.s]+=a.v;else if(a.k==='allsk')s.skill=s.skill.map(x=>x+a.v); /* Sunfire Crucible */else s[a.k]+=a.v*(AFF[a.k].flat?1:m);}
  }
  addSetStats(EQ_SLOTS.map(sl=>eq[sl]).filter(Boolean),s); // set bonuses
  addCharmStats(c,s); // charm pouch
  if(!s.mh&&s.oh){s.mh=s.oh;s.oh=null;} // off-hand weapon with empty main hand acts as the main weapon
  if(s.mh&&s.oh){s.dmin=(s.mh.dmin+s.oh.dmin)/2;s.dmax=(s.mh.dmax+s.oh.dmax)/2;s.wspd=(s.mh.spd+s.oh.spd)/2*1.15;} // dual wield: alternate hands, +15% attack rate
  else if(s.mh){s.dmin=s.mh.dmin;s.dmax=s.mh.dmax;s.wspd=s.mh.spd;}
  const PL=c.para||0;s.dmg+=PL*PARA_DMG;s.life+=PL*PARA_LIFE;
  s.cdr=Math.min(s.cdr,40);s.block=Math.min(s.block,50);s.bleed=Math.min(s.bleed,75);s.stunCh=Math.min(s.stunCh,50);s.splash=Math.min(s.splash,50);s.levelMul=1+0.05*(L-1);
  s.life*=1+s.lifepct/100;s.evade=Math.min(s.evade,40);for(const k of ['igniteCh','shockCh','poisonCh'])s[k]=Math.min(s[k],AIL_CH_CAP);s.dr=Math.min(s.dr,30); // v1.0.70 stats (caps: evade 40%, less damage 30%)
  shrineStats(s);
  if(typeof mapStats==='function')mapStats(s); // sigils.js: a map's modifiers on you
  return s;
}
// Resistance to one element after the difficulty's penalty (maps.js resPenalty), at most 75%; can go below 0.
function resOf(s,k){return Math.min(resCap(s),(s[k]||0)+(s.ares||0)-resPenalty());}
const AIL_CH_CAP=75; // chance to Ignite / Shock / Poison, each
function power(s){const avg=(s.dmin+s.dmax)/2*s.levelMul;const off=avg*(1+s.dmg/100)*(1+s.crit/100*s.critd/100)*(1+s.aspd/100)*(1+s.skill.reduce((a,b)=>a+b,0)*0.08)*(1+s.cdr/200)*s.wspd*(1+s.spell/100)*(1+s.bleed/100*0.8)*(1+s.stunCh/200)*(1+s.splash/200)*(1+s.pierce*0.1)*(1+s.explode/400)*(1+Object.keys(s.pw).length*0.15)*(1+(s.skd0+s.skd1+s.skd2+s.skd3+s.skd4)/500)*(1+s.bossdmg/400)*(1+(s.igniteCh*0.6+s.shockCh*0.5+s.poisonCh*0.5)/100); /* ailment chances: about what they add on average */
  const def=(s.life*(1+s.armor/150)/(1-s.block/100)*(1+s.pot*0.04)+s.loh*20+s.regen*10)*(1+RES_KEYS.reduce((a,k)=>a+Math.max(0,Math.min(RES_CAP,(s[k]||0)+(s.ares||0))),0)/600);return off*Math.sqrt(def/(1-s.evade/100)/(1-s.dr/100))*(1+s.move/400);}
// ---------- loot filter (per character, set in the menu) ----------
// c.filter = {min, rares, autoSalv}: autoSalv salvages plain white items on pickup (see smith.js).
// min 0 = off, 'auto' = hide anything more than one tier below the act you're in,
// 2..5 = hide below that tier. rares (default on) keeps rares and uniques visible. Untiered jewelry is never hidden.
// Hidden items stay on the ground but aren't drawn and aren't picked up.
const filterMin=c=>{const f=c&&c.filter;if(!f||!f.min)return 0;return f.min==='auto'?dropAct(PD())-1:f.min;};
function lootHidden(it){const c=G.char;if(!it||!it.tier||!c||it.sockets)return false; /* socketed bases always show (Runebind material) */
  if(it.rarity===0&&!it.myth&&diffHere()===2&&!(c.filter&&c.filter.hellWhites===false))return true; // v1.0.74: plain whites hidden in Hell and maps (Mythic bases always show)
  const min=filterMin(c);if(!min||it.tier>=min)return false;
  return !(c.filter.rares!==false&&it.rarity>=2);}
// ---------- ground loot comparison (labels and the tooltip for the nearest item) ----------
// Effective base value: average weapon damage or armor, including upgrades.
function baseValue(it){const m=upgMul(it)*(1+(it.q||0)/100);return it.slot==='weapon'?(it.dmin+it.dmax)/2*m:it.arm?it.arm*m:0;}
// A tiered item vs what the character wears where it would go:
// {other} for the other class's gear, else {sl, cur, dt (tier difference), pct (base value change, or null), stat}.
function compareLoot(c,it){
  if(!it.tier)return null;
  const fits=fitsFor(c,it);if(!fits.length)return {other:true};
  // weapons compare with the main weapon (a one-hander could also fill an empty off hand, but that isn't the useful comparison)
  const sl=it.slot==='weapon'&&fits.includes('mainhand')?'mainhand':bestSlot(c,it)||fits[0],cur=c.equip[sl]||null;
  const same=cur&&(cur.slot==='weapon')===(it.slot==='weapon'),bv=baseValue(it),cv=cur?baseValue(cur):0;
  return {sl,cur,dt:it.tier-(cur?cur.tier||0:0),pct:same&&bv&&cv?bv/cv-1:null,stat:it.slot==='weapon'?'damage':'armor'};
}
const potFloor=()=>3+(G.stats?G.stats.pot:0);
const potMax=()=>POT_MAX+(G.stats?G.stats.pot:0);
function xpNeed(l){return Math.round(60*Math.pow(l,1.55));}
// Paragon levels (after level 50, no cap): each costs a little more than the last and gives +1% damage and +5 Life.
const MAX_LVL=50,PARA_DMG=1,PARA_LIFE=5;
const paraNeed=p=>Math.round(xpNeed(MAX_LVL-1)*(1+0.04*p));
