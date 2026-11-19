'use strict';
// Items: slots, weapon/armor archetypes, icons, affixes, drops, generation, save migration, character stats.
// ---------- data ----------
const TILE=40,MW=64,MH=64;
// Equipment slots, in paper-doll display order (5 columns × 2 rows).
const EQ_SLOTS=['mainhand','ring1','helm','amulet','offhand','gloves','ring2','body','belt','boots'];
const SLOT_NAME={mainhand:'Main Hand',offhand:'Off Hand',helm:'Helm',body:'Body',gloves:'Gloves',belt:'Belt',boots:'Boots',amulet:'Amulet',ring1:'Ring 1',ring2:'Ring 2'};
// Item types: which slots they fit, drop weight (w = % of drops; shield and focus share the off-hand 10%, one per class), and affix pool.
const TYPES={
  weapon:{name:'Weapon',slots:['mainhand','offhand'],w:20,pool:['dmg','crit','critd','aspd','loh','life','res','spell']},
  shield:{name:'Shield',slots:['offhand'],w:10,cls:'warden',pool:['armor','life','regen','block','res','loh']},
  focus:{name:'Focus',slots:['offhand'],w:10,cls:'arcanist',pool:['spell','res','cdr','crit','regen','life']},
  helm:{name:'Helm',slots:['helm'],w:10,pool:['life','armor','crit','cdr','res','regen']},
  body:{name:'Body Armor',slots:['body'],w:14,pool:['life','armor','regen','res','cdr']},
  gloves:{name:'Gloves',slots:['gloves'],w:10,pool:['aspd','crit','critd','dmg','loh','armor']},
  belt:{name:'Belt',slots:['belt'],w:10,pool:['life','pot','armor','regen','res']},
  boots:{name:'Boots',slots:['boots'],w:10,pool:['move','life','armor','regen','cdr']},
  amulet:{name:'Amulet',slots:['amulet'],w:6,pool:null}, // null = any affix
  ring:{name:'Ring',slots:['ring1','ring2'],w:10,pool:['life','res','dmg','crit','critd','aspd','cdr','loh','regen','armor','spell']}
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
function rollTier(a,top){if(top||a<=1)return a;const r=Math.random();if(r<0.7)return a;if(r<0.9||a===2)return a-1;return randi(1,a-2);}
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
  thornstaff:{name:'Thornstaff',cls:'arcanist',act:3,hands:2,dmg:1.35,spd:0.85,spell:10,splash:35,anim:'thrust',bases:['Thornstaff','Frostthorn Staff','Emberthorn Staff']},
  runewand:{name:'Runewand',cls:'arcanist',act:4,hands:1,dmg:0.9,spd:1.25,skill:1,anim:'flick',bases:['Runewand','Ember Runewand']},
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
  if(w.bleed)out.push(`${w.bleed}% chance to Bleed (80% of hit over 3s)`);if(w.stun)out.push(`${w.stun}% chance to Stun for ${w.stunDur}s`);
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
const tierLabel=it=>it.tier?'Tier '+TIER_NAME[it.tier-1]:'';
function typeLabel(it){if(it.slot==='charm')return (CHARM[it.size]||CHARM.small).name;if(it.slot==='weapon'){const w=wOf(it);return (w.hands===2?'Two-Handed ':'One-Handed ')+w.name;}if(it.slot==='focus')return (FOCUS[it.kind]||FOCUS.orb).name;return it.slot==='body'&&BODY[it.kind]?BODY[it.kind].name:TYPES[it.slot].name;}
const RCOL=['#c8c8c8','#6f8fff','#f2d04a','#e8882a','#5fd0c0','#3fe05a'];
const RNAME=['Common','Magic','Rare','Unique','Runebind','Set']; // Runebinds (4) never drop: they're forged from runes. Set items are 5.
const SKILL_REQ=[1,2,4,7,10];
const POT_MAX=10;


const CLASSES={
  warden:{name:'Warden',icon:'🪓',color:'#b8683a',res:'Fury',hp:130,hpL:16,mp:100,mpL:0,regen:3,
    desc:'Armored brawler. Cleaves, leaps and whirls through crowds. Builds Fury by hitting.'},
  arcanist:{name:'Arcanist',icon:'🔮',color:'#6b4aa8',res:'Mana',hp:95,hpL:11,mp:80,mpL:4,regen:6,
    desc:'Fragile spellcaster. Hurls fire, frost and lightning from a distance. Uses Mana.'}
};

const AFF={
  life:{t:'+{v} Life',pre:'Hale',suf:'of the Bear',roll:l=>rand(6,12)+l*3.5},
  res:{t:'+{v} Max Fury/Mana',pre:'Spirited',suf:'of the Mind',roll:l=>rand(5,10)+l*0.8},
  dmg:{t:'+{v}% Damage',pre:'Cruel',suf:'of Wrath',roll:l=>rand(6,14)+l*0.6},
  armor:{t:'+{v} Armor',pre:'Sturdy',suf:'of Iron',roll:l=>rand(4,8)+l*2.5},
  crit:{t:'+{v}% Crit Chance',pre:'Keen',suf:'of Precision',roll:l=>rand(2,5)+l*0.08,dec:1},
  critd:{t:'+{v}% Crit Damage',pre:'Deadly',suf:'of Ruin',roll:l=>rand(12,25)+l*0.8},
  aspd:{t:'+{v}% Attack Speed',pre:'Swift',suf:'of Haste',roll:l=>rand(5,12)},
  cdr:{t:'+{v}% Cooldown Reduction',pre:'Focused',suf:'of Ages',roll:l=>rand(3,8)},
  move:{t:'+{v}% Move Speed',pre:'Fleet',suf:'of the Wind',roll:l=>rand(4,10)},
  loh:{t:'+{v} Life on Hit',pre:'Vampiric',suf:'of Leeching',roll:l=>rand(1,3)+l*0.4},
  regen:{t:'+{v} Life per Second',pre:'Mending',suf:'of Renewal',roll:l=>rand(1,2)+l*0.35,dec:1},
  // flat: not multiplied by item upgrades
  block:{t:'+{v}% Block Chance',pre:'Warding',suf:'of the Bulwark',roll:l=>rand(3,6)+Math.min(4,l*0.1),flat:1},
  spell:{t:'+{v}% Spell Damage',pre:'Arcane',suf:'of Sorcery',roll:l=>rand(5,10)+l*0.4,cls:'arcanist'},
  pot:{t:'+{v} Potion Charges',pre:"Brewer's",suf:'of Plenty',roll:l=>rand(1,1.6)+(l>=15?0.6:0),flat:1}
};
const AFF_KEYS=Object.keys(AFF);
// Per-tier base names (Tier I … V); amulets and rings are untiered.
const BASES={shield:[['Buckler','Round Shield'],['Kite Shield','Sandstone Targe'],['Heater','Rotwood Pavise'],['Tower Shield','Frostward Shield'],['Ember Bulwark','Demon Aegis']],
  helm:[['Cap','Hood'],['Helm','Desert Circlet'],['Great Helm','Bog Coif'],['Frost Helm','Winged Helm'],['Cinder Crown','Demon Horns']],
  gloves:[['Gloves','Wraps'],['Bracers','Sandsilk Wraps'],['Gauntlets','Bogleather Gloves'],['Frost Gauntlets','Rime Grips'],['Ember Gauntlets','Demon Claws']],
  belt:[['Sash','Leather Belt'],['Heavy Belt','Sand Sash'],['Girdle','Rotwood Cord'],['Frost Girdle','Plated Belt'],['Ember Girdle','Demon Chain']],
  boots:[['Boots','Sandals'],['Greaves','Dune Treads'],['Marsh Boots','Bog Waders'],['Frost Greaves','Ice Treads'],['Ember Greaves','Demon Hooves']],
  amulet:['Amulet','Pendant','Talisman','Choker'],ring:['Ring','Band','Signet']};
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
// Every monster/boss drop goes through here: bad-luck protection, then the class roll for weapons and off-hands,
// then the base tier. opt.act = the act whose tiers drop (default: from item level); opt.top = always that act's tier (bosses).
function rollDrop(c,ilvl,boost=0,minRarity=0,opt={}){
  const ds=c.dropSince||(c.dropSince={});for(const k of DROP_KEYS)if(typeof ds[k]!=='number')ds[k]=0;
  // Each slot must appear within its next (PITY+1-misses) drops. Sorted by that deadline, if the j-th slot's deadline is <= j
  // there is no slack left, so the most urgent slot drops now. This forces a slot at 15 misses, and also steps in a little
  // early when several slots run out together, so no slot ever goes more than PITY drops without appearing.
  const dl=DROP_KEYS.map(k=>[PITY+1-ds[k],k]).sort((a,b)=>a[0]-b[0]);
  let slot=null;for(let j=0;j<dl.length;j++)if(dl[j][0]<=j+1){slot=dl[0][1];break;}
  if(!slot)slot=pickDropSlot();
  let icls=c.cls;if(slot==='weapon'||slot==='offhand')icls=Math.random()<OWN_CLASS_CHANCE?c.cls:OTHER_CLS[c.cls];
  let type=slot==='offhand'?OFF_TYPE[icls]:slot;
  const tier0=opt.act||tierOfLvl(ilvl);
  let tier=TIERED.has(type)?rollTier(tier0,opt.top):undefined;
  // a guaranteed unique (boss loot) needs a slot that has one: otherwise re-pick among those that do, by drop weight
  if(minRarity>=3&&!uniquesFor(type,icls,tier||tier0).length){
    const ok=[];for(const k of DROP_KEYS){const cs=k==='weapon'||k==='offhand'?[[c.cls,OWN_CLASS_CHANCE],[OTHER_CLS[c.cls],1-OWN_CLASS_CHANCE]]:[[c.cls,1]];
      for(const [ic,w] of cs){const ty=k==='offhand'?OFF_TYPE[ic]:k;if(uniquesFor(ty,ic,tier0).length)ok.push([k,ic,ty,DROP_W[k]*w]);}}
    if(ok.length){let r=Math.random()*ok.reduce((a,o)=>a+o[3],0);let o=ok[ok.length-1];for(const x of ok){r-=x[3];if(r<0){o=x;break;}}
      [slot,icls,type]=o;tier=TIERED.has(type)?tier0:undefined;}
  }
  for(const k of DROP_KEYS)ds[k]=k===slot?0:ds[k]+1;
  return genItem(ilvl,icls,boost,type,minRarity,undefined,tier);
}
function rollAff(k,ilvl,rm=1){const a=AFF[k];const v=a.roll(ilvl)*rm;return {k,v:a.dec?+v.toFixed(1):Math.max(1,Math.round(v))};}
// tier: base tier 1..5 for tiered types (default: the tier of the item level's act). forceSet: make this set piece.
function genItem(ilvl,cls,boost=0,forceType,minRarity=0,forceWt,tier,forceSet){
  if(forceSet){forceType=SET_ITEMS[forceSet].type;forceWt=SET_ITEMS[forceSet].wt;}
  const slot=forceType||pickType(cls); // item.slot holds the item TYPE (weapon, shield, body, ring…)
  const rr=rollRarity(boost);let rarity=forceSet?5:rr===5?(minRarity>=3?3:5):Math.max(minRarity,rr); // a guaranteed unique stays a unique
  // uniques are fixed named items (see uniques.js); with none for this type, class and act the item becomes a rare
  const uact=clamp(Math.round(tier||tierOfLvl(ilvl)),1,5);let U=null;
  if(rarity===3){const ks=uniquesFor(slot,cls,uact).filter(k=>!forceWt||UNIQUES[k].wt===forceWt);if(ks.length){U=pick(ks);forceWt=UNIQUES[U].wt||forceWt;}else rarity=2;}
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
  else it.base=pick(it.tier?BASES[slot][it.tier-1]:BASES[slot]);
  if(ARM[slot])it.arm=(ARM[slot][0]+bl*ARM[slot][1])*rand(0.9,1.1);
  // implicit properties (always present on that type); they scale with the base, affixes with item level
  if(slot==='shield')it.imp=[{k:'block',v:Math.round(rand(8,13)+Math.min(8,bl*0.25))}];
  if(slot==='boots')it.imp=[{k:'move',v:randi(3,6)}];
  if(slot==='belt')it.imp=[Math.random()<0.5?{k:'pot',v:bl>=12&&Math.random()<0.35?2:1}:{k:'life',v:Math.round(AFF.life.roll(bl)*0.7)}];
  let n=[0,randi(1,2),randi(3,4),4][rarity];if(slot==='ring'||slot==='amulet')n=Math.max(1,n);
  const pool=(TYPES[slot].pool||AFF_KEYS).filter(k=>!AFF[k].cls||AFF[k].cls===cls);
  const keys=SI?SET_ITEMS[SI].affs.slice():pool.slice().sort(()=>Math.random()-0.5).slice(0,n);
  for(const k of keys)it.affs.push(rollAff(k,ilvl,rm));
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
function affText(a,m,cls){if(a.k==='skill')return `+${a.v} to ${SKILLS[cls][a.s].name}`;return AFF[a.k].t.replace('{v}',affVal(a,m));}

// ---------- save migration (v1: weapon/helm/armor/ring → v2: 10 slots) ----------
const SAVE_VER=7;
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
  if(it.rarity===3&&!it.uq){const k=Object.keys(UNIQUES).find(k=>UNIQUES[k].name===it.name&&UNIQUES[k].type===it.slot&&(!UNIQUES[k].wt||UNIQUES[k].wt===it.wt));if(k)it.uq=k;}
  if(it.uq&&!UNIQUES[it.uq])delete it.uq;
  if(it.rarity===5&&!SET_ITEMS[it.si])it.rarity=2; // a set piece this version doesn't know stays as a rare
  if(it.si&&it.rarity!==5)delete it.si;
  if(!(it.rarity>=0&&it.rarity<RNAME.length))it.rarity=it.affs.length?2:0;
  if(it.lock!==true)delete it.lock;
  if(it.sockets!=null){it.sockets=clamp(Math.floor(+it.sockets)||0,0,4);if(!it.sockets)delete it.sockets;}
  if(it.socketed){it.socketed=(Array.isArray(it.socketed)?it.socketed:[]).filter(s=>s&&(s.r?RUNES[s.r]:GEMS[s.g]&&s.q>=1&&s.q<=5)).slice(0,it.sockets||0);if(!it.socketed.length)delete it.socketed;}
  if(it.rb&&!RUNEBINDS[it.rb]){delete it.rb;if(it.rarity===4)it.rarity=0;}
  if(TIERED.has(it.slot)&&!(it.tier>=1&&it.tier<=5))it.tier=tierOfLvl(it.ilvl); // pre-tier items: their stats already match the tier of their item level
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
  if(c.won==null)c.won=(c.maxDepth||1)>25; // anyone already past depth 25 has beaten the Cinder King
  if(c.actSeen==null){const d=c.depth||1;c.actSeen=stageOf(d)===1?d-1:d-stageOf(d)+1;} // depth N is already Act ceil(N/5); only show titles for acts not yet entered
  migrateCharms(c);matsOf(c); // crafting materials
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
function bestSlot(c,it){const fits=fitsFor(c,it).filter(s=>is2h(it)||slotOpen(c.equip,s));if(fits.length<=1)return fits[0]||null;
  const empty=fits.find(s=>!c.equip[s]);if(empty)return empty;
  let best=fits[0],bp=-1;for(const s of fits){const p=power(calcStats(c,it,s));if(p>bp){bp=p;best=s;}}return best;}
function calcStats(c,swap,at){
  const C=CLASSES[c.cls],L=c.lvl;
  const s={life:C.hp+C.hpL*(L-1),res:C.mp+C.mpL*(L-1),dmg:0,armor:0,crit:5,critd:50,aspd:0,cdr:0,move:0,loh:0,regen:0.5+L*0.1,block:0,pot:0,spell:0,bleed:0,stunCh:0,stunDur:0,pw:{},gold:0,loot:0,splash:0,pierce:0,explode:0,dmin:3,dmax:5,wspd:1,mh:null,oh:null,skill:[0,0,0,0,0]};
  if(swap&&at===undefined)at=bestSlot(c,swap);
  const eq=Object.assign({},c.equip);if(swap&&at)eq[at]=swap;if(is2h(eq.mainhand))eq.offhand=null;
  for(const sl of EQ_SLOTS){
    const it=eq[sl];if(!it)continue;
    const m=1+0.1*(it.upg||0);
    if(it.slot==='weapon'){const w=wOf(it);const hand={wt:it.wt,dmin:it.dmin*m,dmax:it.dmax*m,spd:w.spd};if(sl==='mainhand')s.mh=hand;else s.oh=hand;
      s.crit+=w.crit||0;s.critd+=w.critd||0;s.block+=w.block||0;s.bleed+=w.bleed||0;s.spell+=w.spell||0;if(w.stun){s.stunCh+=w.stun;s.stunDur=Math.max(s.stunDur,w.stunDur);}
      s.splash+=w.splash||0;s.pierce=Math.max(s.pierce,w.pierce||0);s.explode=Math.max(s.explode,w.explode||0);}
    for(const k of itemPowers(it))s.pw[k]=true;
    if(it.arm)s.armor+=it.arm*m;
    if(it.socketed){const h=hostOf(it);for(const sg of it.socketed){const a=stoneStat(sg,h);s[a.k]+=a.v;}} // gems and runes: flat, not upgraded
    for(const a of it.imp?it.affs.concat(it.imp):it.affs){if(a.k==='skill')s.skill[a.s]+=a.v;else s[a.k]+=a.v*(AFF[a.k].flat?1:m);}
  }
  addSetStats(EQ_SLOTS.map(sl=>eq[sl]).filter(Boolean),s); // set bonuses
  addCharmStats(c,s); // charm pouch
  if(!s.mh&&s.oh){s.mh=s.oh;s.oh=null;} // off-hand weapon with empty main hand acts as the main weapon
  if(s.mh&&s.oh){s.dmin=(s.mh.dmin+s.oh.dmin)/2;s.dmax=(s.mh.dmax+s.oh.dmax)/2;s.wspd=(s.mh.spd+s.oh.spd)/2*1.15;} // dual wield: alternate hands, +15% attack rate
  else if(s.mh){s.dmin=s.mh.dmin;s.dmax=s.mh.dmax;s.wspd=s.mh.spd;}
  s.cdr=Math.min(s.cdr,40);s.block=Math.min(s.block,50);s.bleed=Math.min(s.bleed,75);s.stunCh=Math.min(s.stunCh,50);s.splash=Math.min(s.splash,50);s.levelMul=1+0.05*(L-1);
  shrineStats(s);
  return s;
}
function power(s){const avg=(s.dmin+s.dmax)/2*s.levelMul;const off=avg*(1+s.dmg/100)*(1+s.crit/100*s.critd/100)*(1+s.aspd/100)*(1+s.skill.reduce((a,b)=>a+b,0)*0.08)*(1+s.cdr/200)*s.wspd*(1+s.spell/100)*(1+s.bleed/100*0.8)*(1+s.stunCh/200)*(1+s.splash/200)*(1+s.pierce*0.1)*(1+s.explode/400)*(1+Object.keys(s.pw).length*0.15);
  const def=s.life*(1+s.armor/150)/(1-s.block/100)*(1+s.pot*0.04)+s.loh*20+s.regen*10;return off*Math.sqrt(def)*(1+s.move/400);}
// ---------- loot filter (per character, set in the menu) ----------
// c.filter = {min, rares, autoSalv}: autoSalv salvages plain white items on pickup (see smith.js).
// min 0 = off, 'auto' = hide anything more than one tier below the act you're in,
// 2..5 = hide below that tier. rares (default on) keeps rares and uniques visible. Untiered jewelry is never hidden.
// Hidden items stay on the ground but aren't drawn and aren't picked up.
const filterMin=c=>{const f=c&&c.filter;if(!f||!f.min)return 0;return f.min==='auto'?dropAct(G.depth||1)-1:f.min;};
function lootHidden(it){const c=G.char;if(!it||!it.tier||!c||it.sockets)return false; /* socketed bases always show (Runebind material) */const min=filterMin(c);if(!min||it.tier>=min)return false;
  return !(c.filter.rares!==false&&it.rarity>=2);}
// ---------- ground loot comparison (labels and the tooltip for the nearest item) ----------
// Effective base value: average weapon damage or armor, including upgrades.
function baseValue(it){const m=1+0.1*(it.upg||0);return it.slot==='weapon'?(it.dmin+it.dmax)/2*m:it.arm?it.arm*m:0;}
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
